import * as core from "@actions/core";
import * as github from "@actions/github";
import { GitHub } from "@actions/github/lib/utils";
import { LandAfterCommand } from "./comment";

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
    mergeable?: boolean | null;
  }
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
        console.log(`Not satisfied with ${JSON.stringify(dependency)}`);
        break;
      }
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

  if (!pr.mergeable) {
    console.log("pull request is not yet mergeable.");
  }

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
    body:
      "This pull request was automatically merged because all conditions from the last `autoland after` command were met.",
  });
}
