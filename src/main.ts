import * as core from "@actions/core";
import * as github from "@actions/github";
import { GitHub } from "@actions/github/lib/utils";
import { env } from "process";
import { LandAfterCommand } from "./comment";

async function checkPullRequest(
  client: InstanceType<typeof GitHub>,
  pullRequestNumber: number
) {
  var prInfo = {
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,

    // For pulls API
    pull_number: pullRequestNumber,

    // For comments API
    issue_number: pullRequestNumber,
    per_page: 100,
  };

  var pr = await client.rest.pulls.get(prInfo);
  if (pr.data.state !== "open") {
    return;
  }

  var comments = await client.rest.issues.listComments(prInfo);

  // Now get the LAST comment on the PR that contains a command
  var cmd: LandAfterCommand | null | undefined;

  comments.data.reverse().find((comment) => {
    try {
      var _cmd = LandAfterCommand.parse(
        comment.body || comment.body_text || ""
      );
      if (_cmd.dependencies.length === 0) {
        return false;
      }

      cmd = _cmd;
      return true;
    } catch (e) {
      console.log("Error while parsing comment at " + comment.url + ": " + e);
      return false;
    }
  });

  if (!cmd) {
    console.log("pull request doesn't have a commands associated with it");
    return;
  }

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

  console.log("would merge");
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
        // Here we are working on a single issue:
        // - check if that issue should be worked on (check for a comment that indicates so)
        // - check if the condition for the comment is met
        // - check if the current pull request checks have all passed, it's not a draft
        //   idea: add "waiting-for-other" label

        await checkPullRequest(client, github.context.issue.number);

        break;
      case "workflow_dispatch":
      case "schedule":
        // Here

        break;
      default:
        throw new Error("unexpected event name " + github.context.eventName);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
