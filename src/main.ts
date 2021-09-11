import * as core from "@actions/core";
import * as github from "@actions/github";
import { GitHub } from "@actions/github/lib/utils";
import { env } from "process";
import { LandAfterCommand } from "./comment";

// checkPullRequest checks if a PR can be merged and does so if possible
// - check if that issue should be worked on (check for a comment that indicates so)
// - check if the condition for the comment is met
// - check if the current pull request checks have all passed, it's not a draft
async function checkPullRequest(
  client: InstanceType<typeof GitHub>,
  pr: { state: string; number: number; draft?: boolean; body: string | null }
) {
  console.log(
    `Checking PR ${github.context.repo.owner}/${github.context.repo.repo}#${github.context.issue.number}`
  );

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

  var comments = await client.rest.issues.listComments(prInfo).catch((e) => {
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

  if (pr.body) {
    parseCommandText(pr.body);
  }
  comments.data.reverse().find((comment) => {
    return parseCommandText(comment.body || comment.body_text || "");
  });

  if (!cmd) {
    console.log("pull request doesn't have any commands associated with it");
    return;
  }

  console.log(`Found command:\n${JSON.stringify(cmd, null, 4)}`);

  // Now we can check if the PR command is satisfied

  var satisfied = true;

  for (const dependency of cmd.dependencies) {
    try {
      var _satisfied = await dependency.isSatisfied(
        client,
        prInfo.owner,
        prInfo.repo
      );
      if (!_satisfied) {
        satisfied = false;
        console.log(`Not satisfied with ${JSON.stringify(dependency)}`);
        break;
      }
    } catch (e) {
      console.log("error while checking satisfaction: " + e);
      satisfied = false;
    }
  }

  if (!satisfied) {
    console.log("pull request is not yet satisfied");
    return;
  }

  console.log("All conditions are satisfied.");

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
}

async function run(): Promise<void> {
  try {
    const client = github.getOctokit(env.GITHUB_TOKEN || "");

    core.debug("event name: " + github.context.eventName);

    switch (github.context.eventName) {
      case "pull_request":
      case "issue_comment":
      case "pull_request_review":
      case "pull_request_review_comment":
      case "check_suite":
        // Here we are working on a single pr (github treats them as issues):

        var pr = await client.rest.pulls.get({
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,

          pull_number: github.context.issue.number,
        });

        await checkPullRequest(client, pr.data);

        break;
      case "workflow_dispatch":
      case "schedule":
        console.log(
          `Requesting 100 open pull requests from ${github.context.repo.owner}/${github.context.repo.repo}`
        );

        // Get all open PRs and check them
        var currentPRs = await client.rest.pulls.list({
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,
          state: "open",
          per_page: 100,
        });

        console.log(
          `Checking all ${currentPRs.data.length} PRs for mergeability`
        );

        for (const pr of currentPRs.data) {
          try {
            await checkPullRequest(client, pr);
          } catch (e) {
            console.log(`Error while checking ${pr.id}: ${e}`);
            console.trace();
          }
        }

        break;
      default:
        throw new Error("unexpected event name " + github.context.eventName);
    }
  } catch (error) {
    core.setFailed("Error while running action: " + error.message);

    console.trace();
  }
}

run();
