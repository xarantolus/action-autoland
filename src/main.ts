import * as core from "@actions/core";
import * as github from "@actions/github";
import { GitHub } from "@actions/github/lib/utils";
import { env } from "process";
import { LandAfterCommand } from "./comment";

import { checkPullRequest } from "./pr";

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
            console.log(`Error while checking ${pr.number}: ${e}`);
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
