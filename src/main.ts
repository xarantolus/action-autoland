import * as core from "@actions/core";
import * as github from "@actions/github";
import { env } from "process";

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

        var prInfo = {
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,

          // For pulls API
          pull_number: github.context.issue.number,

          // For comments API
          issue_number: github.context.issue.number,
          per_page: 100,
        };

        var pr = await client.rest.pulls.get(prInfo);
        core.group("pull request info", async () => {
          console.log(JSON.stringify(pr));
        });

        var comments = await client.rest.issues.listComments(prInfo);
        core.group("pull request comments", async () => {
          console.log(JSON.stringify(comments));
        });

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
