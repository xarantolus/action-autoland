import * as github from "@actions/github";


export class LandAfterCommand {

  dependencies: Reference[];

  constructor(_dependencies: Reference[]) {
    this.dependencies = _dependencies;
  }

  /*
    Comment syntax:

    Merge after something has been merged:

        autoland after other/repo#15
        autoland after other/repo/commithash
        autoland after https://github.com/other/repo/commit/commithash [in branch]

    Merge after multiple (AND):

        autoland after other/repo#15, other/repo#16
  */
  public static parse(body: string): LandAfterCommand {
    const regex = /autoland after (.+)/ig;

    var references: Reference[] = [];

    let m;

    while ((m = regex.exec(body)) !== null) {
      // This is necessary to avoid infinite loops with zero-width matches
      if (m.index === regex.lastIndex) {
        regex.lastIndex++;
      }

      // The result can be accessed through the `m`-variable.
      this.parseInner(m[1]).forEach(r => {
        if (!references.find((val) => val.equals(r))) {
          references.push(r)
        }
      });
    }

    return new LandAfterCommand(references);
  }

  private static parseInner(referenceText: string): Reference[] {
    // split "a,;b;c" => ["a", "b", "c"]
    var references = referenceText
      .split(/[,;]/g)
      .map(s => s.trim())
      .filter(s => s.length !== 0);

    return references.map((r) => Reference.parse(r));
  }
}

export class Reference {
  public repoSlug: String | undefined;

  public issueNumber: number | undefined;

  public commitHash: string | undefined;
  public commitBranch: string | undefined;

  constructor(repo?: String, issue?: number, commit?: string) {
    this.repoSlug = repo;

    this.issueNumber = issue;
    this.commitHash = commit;
  }

  public equals(other: Reference) {
    return this.repoSlug === other.repoSlug && this.issueNumber === other.issueNumber
      && this.commitHash === other.commitHash && this.commitBranch === other.commitBranch;
  }

  // Parse parses a reference from text like the following:
  // * #15
  // * user/repo#15
  // * #7057a654720ef532ad11f920e57a33f59890d702

  static parse(refText: string): Reference {
    if (refText.length === 0) {
      throw new Error("refText is empty");
    }
    // Is it a github repo text like user/repo ?
    var slugOnlyRegex = /^(?:https?:\/\/github\.com\/)?([^\/]+\/[^\/#]+)\/?$/;
    var m = slugOnlyRegex.exec(refText);
    if (m && m.length == 2) {
      return new Reference(m[1]);
    }

    // Is it a commit hash?
    var commitReg = /^(\d|[a-f])*$/;
    if (commitReg.test(refText)) {
      return new Reference(undefined, undefined, refText);
    }

    var refRegex = /^(?:https?:\/\/github\.com\/)?(\S+\/\S+)?(\/(commit|pull|issue))?(?:[\/#](\w+))$/gi;

    var res = refRegex.exec(refText);
    if (res == null) {
      throw new Error("didn't match anything");
    }
    if (res.length !== 5) {
      throw new Error("expected res.length to be 5, but is " + res.length);
    }

    var issueNumber = /^\d*$/.test(res[4])
      ? parseInt(res[4], 10) || undefined
      : undefined;

    var commitHash = issueNumber ? undefined : res[4];
    if (!commitReg.test(commitHash || "")) {
      throw new Error("malformed commit hash " + commitHash);
    }

    var repoSplit = (res[1] || "").split("/");
    var repoSlug =
      repoSplit.length < 2 ? undefined : repoSplit.slice(0, 2).join("/");

    if (repoSplit.length > 2) {
      // either commit|pull|issue
      var linkPart = repoSplit[2].toLowerCase();

      if (commitHash && ["pull", "issue"].includes(linkPart)) {
        throw new Error("parsing error: got commit hash from pr/issue url");
      }

      if (issueNumber && linkPart == "commit") {
        throw new Error("parsing error: got issue number from commit url");
      }
    }

    if (issueNumber && commitHash) {
      throw new Error(
        "parsing error: got issue number and commit hash at the same time"
      );
    }

    return new Reference(repoSlug, issueNumber, commitHash);
  }
}
