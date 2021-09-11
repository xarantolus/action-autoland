import * as core from "@actions/core";
import * as github from "@actions/github";
import { env } from "process";

async function run(): Promise<void> {
  try {
    const client = github.getOctokit(env.GITHUB_TOKEN || "");

    console.log(env.GITHUB_EVENT_NAME);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
