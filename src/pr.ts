import * as core from "@actions/core";
import * as github from "@actions/github";
import { GitHub } from "@actions/github/lib/utils";
import { LandAfterCommand } from "./comment";

function authorHasPermission(association: string | null | undefined) {
  if (!association) {
    return false;
  }

  var allowedAssociations = core
    .getInput("users")
    .split(/,\s+/g)
    .map((x) => x.toUpperCase().trim())
    .filter((x) => x.length !== 0);

  return allowedAssociations.includes(association.toUpperCase().trim());
}

// checkPullRequest checks if a PR can be merged and does so if possible
// - check if that issue should be worked on (check for a comment that indicates so)
// - check if the condition for the comment is met
// - check if the current pull request checks have all passed, it's not a draft
export async function checkPullRequest(
  client: InstanceType<typeof GitHub>,
  pr: {
    state: string;
    number: number;
    draft?: boolean;
    body: string | null;
    author_association?: string | null;
    head: { sha: string };
  }
) {
  await core.group(
    `Checking PR ${github.context.repo.owner}/${github.context.repo.repo}#${pr.number}`,
    async () => {
      if (pr.state !== "open") {
        console.log("PR is not open, cannot proceed");
        return;
      }
      if (pr.draft) {
        console.log("PR is a draft, cannot proceed");
        return;
      }

      var prInfo = {
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,

        issue_number: pr.number,
        per_page: 100,
      };

      var comments = await client.rest.issues
        .listComments(prInfo)
        .catch((e) => {
          throw new Error("Listing comments: " + e);
        });

      // Now get the LAST comment on the PR (or PR body itself) that contains a command
      var cmd: LandAfterCommand | null | undefined;

      var parseCommandText = function (text: string) {
        try {
          var _cmd = LandAfterCommand.parse(text);
          if (_cmd.dependencies.length === 0) {
            return false;
          }

          cmd = _cmd;
          return true;
        } catch (e) {
          console.log("Error while parsing comment: " + e + "\nBody:\n" + text);
          return false;
        }
      };

      if (pr.body && authorHasPermission(pr.author_association)) {
        parseCommandText(pr.body);
      }
      comments.data.reverse().find((comment) => {
        if (authorHasPermission(comment.author_association)) {
          return parseCommandText(comment.body || comment.body_text || "");
        }
        return false;
      });

      if (!cmd) {
        console.log(
          "pull request doesn't have any commands associated with it"
        );
        return;
      }

      console.log(
        `Waiting for the following conditions for merge:\n${cmd.dependencies
          .map((x) => " -> " + x.describeWaiting())
          .join("\n")}`
      );

      // Check if all runs/checks for this PR are passed/green
      var checks = await client.rest.checks.listForRef({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,

        ref: pr.head.sha,
      });

      var checksNotOk = checks.data.check_runs.find((run) => {
        // if it isn't neutral, successful or skipped, then we need to wait a bit longer
        return !["neutral", "success", "skipped"].includes(
          run.conclusion || ""
        );
      });

      if (checksNotOk) {
        console.log(
          `Check ${checksNotOk.name} is not OK, it's state is ${
            checksNotOk.conclusion || "not yet available"
          }`
        );

        return;
      }

      // Now we can check if the PR command is satisfied

      var satisfied = true;

      for (const dependency of cmd.dependencies) {
        try {
          satisfied = await dependency.isSatisfied(
            client,
            prInfo.owner,
            prInfo.repo
          );
        } catch (e) {
          console.log("error while checking satisfaction: " + e);
          satisfied = false;
        } finally {
          if (!satisfied) {
            console.log(
              `Not yet satisfied with (at least) ${JSON.stringify(dependency)}`
            );
            break;
          }
        }
      }

      if (!satisfied) {
        console.log("pull request is not yet satisfied");
        return;
      }

      console.log(
        "Dependency conditions are satisfied. Continuing with merge."
      );

      var mergeMethod = core.getInput("merge-method", {
        required: true,
      });

      await client.rest.pulls.merge({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,

        pull_number: pr.number,

        // cast to any, then typescript doesn't complain about assignability
        merge_method: <any>mergeMethod,
      });

      await client.rest.issues.createComment({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        issue_number: pr.number,
        body: "This pull request was automatically merged because all conditions from the last `autoland after` command were met.",
      });
    }
  );
}
