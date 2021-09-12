import * as core from "@actions/core";
import * as github from "@actions/github";
import { GitHub } from "@actions/github/lib/utils";
import { LandAfterCommand, STATUS_COMMENT_MARKER } from "./comment";

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
          // Ignore our own comments
          if (text.includes(STATUS_COMMENT_MARKER)) {
            return false;
          }

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

      // Search the status comment.
      var statusComment = comments.data.find((comment) => {
        // find the github actions bot user that commented with our marker text
        return (
          (comment.body || comment.body_text || "").includes(
            STATUS_COMMENT_MARKER
          ) && comment.user?.type === "Bot"
        );
      });

      // We delete the status comment if the autoland command is no longer there.
      // This allows users to update their comments to remove the autoland condition
      if (!cmd) {
        if (statusComment) {
          await client.rest.issues.deleteComment({
            owner: prInfo.owner,
            repo: prInfo.repo,
            comment_id: statusComment.id,
          });
          console.log(
            "deleted status comment as the command is no longer pressent"
          );
          return;
        }

        console.log(
          "pull request doesn't have any commands associated with it"
        );
        return;
      }

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

      // Now we check if the conditions/dependencies on other commits/PRs is satisfied
      var satisfaction = await cmd.checkSatisfaction(
        client,
        checks.data.total_count === 0 ? null : !checksNotOk,
        prInfo.owner,
        prInfo.repo
      );

      // First of all, we now update or create a status comment

      if (statusComment) {
        // If we have a status comment, we update it IF THE TEXT CHANGED
        var commentBody = statusComment.body || statusComment.body_text || "";

        // If a status changed, we update our comment
        if (commentBody.trim() !== satisfaction.commentText.trim()) {
          await client.rest.issues.updateComment({
            owner: prInfo.owner,
            repo: prInfo.repo,
            comment_id: statusComment.id,
            body: satisfaction.commentText,
          });
          console.log("Updated our status comment with new status");
        }
      } else {
        // Create the status comment on this PR (as an issue comment)
        await client.rest.issues.createComment({
          owner: prInfo.owner,
          repo: prInfo.repo,
          issue_number: prInfo.issue_number,
          body: satisfaction.commentText,
        });
        console.log("Created our status comment");
      }

      if (!satisfaction.satisfied) {
        console.log("Merge conditions are not yet satisfied, we are done here");
        return;
      }

      // We can merge this PR because all our conditions are met.

      if (checksNotOk) {
        console.log(
          `Check ${checksNotOk.name} is not OK, it's state is ${
            checksNotOk.conclusion || "not yet available"
          }`
        );
        return;
      }

      // Now that we know that everything is OK, we merge the PR
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

      // At the end, we create a comment
      await client.rest.issues.createComment({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        issue_number: pr.number,
        body: "This pull request was automatically merged because all conditions from the last `autoland after` command were met.",
      });
    }
  );
}
