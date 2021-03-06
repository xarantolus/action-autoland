import { GitHub } from "@actions/github/lib/utils";
import * as github from "@actions/github";

export class Reference {
  public repoSlug: String | undefined;

  public issueNumber: number | undefined;

  public commitHash: string | undefined;
  public commitBranch: string | undefined;

  constructor(repo?: String, issue?: number, commit?: string, branch?: string) {
    this.repoSlug = repo;

    this.issueNumber = issue;
    this.commitHash = commit;
    this.commitBranch = branch;
  }

  public equals(other: Reference) {
    return (
      this.repoSlug === other.repoSlug &&
      this.issueNumber === other.issueNumber &&
      this.commitHash === other.commitHash &&
      this.commitBranch === other.commitBranch
    );
  }

  // Parse parses a reference from text like the following:
  // * #15
  // * user/repo#15
  // * #7057a654720ef532ad11f920e57a33f59890d702

  static parse(refText: string): Reference {
    if (refText.length === 0) {
      throw new Error("refText is empty");
    }

    // Is it a commit hash?
    var commitWithBranchReg = /^([\da-f]+)\s*(?:in\s+([^\/#]+))?$/;
    var m = commitWithBranchReg.exec(refText);
    if (m) {
      return new Reference(undefined, undefined, m[1], m[2]);
    }

    var refRegex =
      /^(?:https?:\/\/github\.com\/)?(\S+\/\S+)?(\/(commit|pull|issues?))?(?:[\/#@](\w+))\s*(?:in\s+([^\/#]+))?$/gi;

    var res = refRegex.exec(refText);
    if (res == null) {
      throw new Error("didn't match anything");
    }
    if (res.length !== 6) {
      throw new Error("expected res.length to be 6, but is " + res.length);
    }

    var issueNumber = /^\d*$/.test(res[4])
      ? parseInt(res[4], 10) || undefined
      : undefined;

    var commitHash = issueNumber ? undefined : res[4];
    var commitHashReg = /^([\da-f]*)$/;
    if (!commitHashReg.test(commitHash || "")) {
      throw new Error("malformed commit hash " + commitHash);
    }

    var targetBranch = res[5] || undefined;

    if (!commitHash && targetBranch) {
      throw new Error("need a commit hash for target branch matching");
    }

    var repoSplit = (res[1] || "").split("/");
    var repoSlug =
      repoSplit.length < 2 ? undefined : repoSplit.slice(0, 2).join("/");

    if (repoSplit.length > 2) {
      // either commit|pull|issue
      var linkPart = repoSplit[2].toLowerCase();

      // pull and issue are fine, because you can link to a commit that is part of a pull request,
      // e.g. https://github.com/xarantolus/action-autoland/pull/2/commits/8bd5cf32e6094213d80eac4d3176ca9b75b884a7
      if (issueNumber && linkPart == "commit") {
        throw new Error("parsing error: got issue number from commit url");
      }
    }

    if (issueNumber && commitHash) {
      throw new Error(
        "parsing error: got issue number and commit hash at the same time"
      );
    }

    return new Reference(repoSlug, issueNumber, commitHash, targetBranch);
  }

  private repoInfo(
    fallbackOwner: string,
    fallbackRepo: string
  ): { owner: string; repo: string } {
    if (this.repoSlug) {
      var split = this.repoSlug.split("/");
      if (split.length == 2) {
        return {
          owner: split[0],
          repo: split[1],
        };
      }
    }
    return {
      owner: fallbackOwner,
      repo: fallbackRepo,
    };
  }

  public async isSatisfied(
    client: InstanceType<typeof GitHub>,
    fallbackOwner: string,
    fallbackRepo: string
  ): Promise<boolean> {
    var repo = this.repoInfo(fallbackOwner, fallbackRepo);

    // If we have an issue number, we check that the issue/pull request referenced by it is closed
    if (this.issueNumber) {
      var issue = await client.rest.issues.get({
        issue_number: this.issueNumber,
        owner: repo.owner,
        repo: repo.repo,
      });

      if (issue.status === 200) {
        // A closed issue is good
        return issue.data.state == "closed";
      }

      // A deleted issue also counts as closed, as we can no longer receive updates from it
      if ([404, 410].includes(issue.status)) {
        return true;
      }

      // Anything else indicates a problem
      throw new Error(
        "problem while looking up issue/pr: status " + issue.status
      );
    }

    if (this.commitHash) {
      var commitInfo = await client.rest.repos.compareCommitsWithBasehead({
        owner: repo.owner,
        repo: repo.repo,
        basehead: `${this.commitBranch || "HEAD"}...${this.commitHash}`,
      });

      if (commitInfo.status === 200) {
        return ["identical", "behind"].includes(commitInfo.data.status);
      }

      throw new Error(
        "problem while looking up commit: status " + commitInfo.status
      );
    }

    throw new Error(
      `cannot look up satisfaction for dependency \`${JSON.stringify(
        this
      )}\`, it doesn't make sense (no issue number AND no commit hash)`
    );
  }

  public describeWaiting(): string {
    if (this.issueNumber) {
      return `PR/Issue ${this.repoSlug || ""}#${
        this.issueNumber
      } must be closed (or deleted)`;
    }

    if (this.commitHash) {
      return `commit ${this.repoSlug ? this.repoSlug + "@" : null || ""}${
        this.commitHash
      } must be merged into the ${this.commitBranch || "default"} branch of ${
        this.repoSlug ? "its" : "this"
      } repository`;
    }

    return JSON.stringify(this);
  }

  public describeDone(): string {
    if (this.issueNumber) {
      return `PR/Issue ${this.repoSlug || ""}#${
        this.issueNumber
      } has been closed (or deleted)`;
    }

    if (this.commitHash) {
      return `commit ${this.repoSlug ? this.repoSlug + "@" : null || ""}${
        this.commitHash
      } has been merged into the ${this.commitBranch || "default"} branch of ${
        this.repoSlug ? "its" : "this"
      } repository`;
    }

    return JSON.stringify(this);
  }

  public describeNeutral(): string {
    if (this.issueNumber) {
      return `PR/Issue ${this.repoSlug || ""}#${this.issueNumber}`;
    }

    if (this.commitHash) {
      return `commit ${this.repoSlug ? this.repoSlug + "@" : null || ""}${
        this.commitHash
      } going into the ${this.commitBranch || "default"} branch of ${
        this.repoSlug ? "its" : "this"
      } repository`;
    }

    return JSON.stringify(this);
  }
}
