import { Reference } from "./git";
import { GitHub } from "@actions/github/lib/utils";

// STATUS_COMMENT_MARKER allows us to recognize status comments that were made by us. They are appended at every comment the bot makes
export const STATUS_COMMENT_MARKER =
  "<!-- autoland STATUS_COMMENT_MARKER PR5s64N80a0m7mXuAYW7t3Nx67d03S8v2yLoodq903WX28fzN72782zKq5p8R0KpxIe0095fzOvhbF142M41spZ69ctg01xh3BDU4tBRa7jFqoG4O7G1aYwu3zKx2wquKan65jq2CPcBRQ3l3R5L0gC081TTdz118pRIr0O3AK097g816y1Ld57QyvY1vv4kRIz7MmMtd0Hq2VFW61PC97rMXNLV08429tqnT7vC8y5V5m57E46RNX1RT705x6rK -->";

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
    const regex = /autoland after ([^\r\n]+?)(?:!|\.+\s|\n|\.+$|$)/gi;

    var references: Reference[] = [];

    let m;

    while ((m = regex.exec(body)) !== null) {
      // This is necessary to avoid infinite loops with zero-width matches
      if (m.index === regex.lastIndex) {
        regex.lastIndex++;
      }

      // The result can be accessed through the `m`-variable.
      this.parseInner(m[1]).forEach((r) => {
        // Do not keep duplicates
        if (!references.find((val) => val.equals(r))) {
          references.push(r);
        }
      });
    }

    return new LandAfterCommand(references);
  }

  private static parseInner(referenceText: string): Reference[] {
    // split "a,;b;c" => ["a", "b", "c"]
    var references = referenceText
      .split(/[,;]/g)
      .map((s) => s.trim())
      .filter((s) => s.length !== 0);

    return references.map((r) => Reference.parse(r));
  }

  public async checkSatisfaction(
    client: InstanceType<typeof GitHub>,
    checkRunsOK: boolean | null,
    fallbackOwner: string,
    fallbackRepo: string
  ): Promise<Satisfaction> {
    var statuses = new Map<Reference, boolean | string>();

    // Request the status for each reference
    for (const ref of this.dependencies) {
      try {
        statuses.set(
          ref,
          await ref.isSatisfied(client, fallbackOwner, fallbackRepo)
        );
      } catch (e) {
        statuses.set(ref, e.message || e.toString() || "unknown error");
      }
    }

    return new Satisfaction(
      this.generateCommentText(statuses, checkRunsOK),
      statuses
    );
  }

  public generateCommentText(
    statuses: Map<Reference, boolean | string>,
    checkRunsOK: boolean | null
  ): string {
    var successfulText: string = "",
      blockingText: string = "",
      errorText: string = "";

    // Now we can generate a markdown list for each status

    if (checkRunsOK !== null) {
      if (checkRunsOK) {
        successfulText += " * ?????? All checks completed successfully\n";
      } else {
        blockingText += " * ???? Not all checks have run successfully\n";
      }
    }

    for (const [ref, status] of statuses) {
      if (status === true) {
        successfulText += " * ?????? " + ref.describeDone() + "\n";
      } else if (status === false) {
        blockingText += " * ???? " + ref.describeWaiting() + "\n";
      } else {
        // Status is the error message string
        errorText +=
          " * ?????? " +
          ref.describeNeutral() +
          ": " +
          capitalize(<string>status) +
          "\n";
      }
    }

    var commentText = "### Autoland status report\n\n";
    if (successfulText) {
      commentText += "**Done**\n\n" + successfulText + "\n";
    }
    // Put blockers and error text in the same list, as both are blocking
    if (blockingText || errorText) {
      commentText += "**Blockers**\n\n" + blockingText + errorText + "\n";
    }

    commentText +=
      "\nYou can overwrite all auto merge conditions by editing the command text or creating a new comment.\n";

    commentText += `<div align="right"><sub>If you notice any problems, you can <a href="https://github.com/xarantolus/action-autoland">report an issue</a>.</sub></div>\n`;

    // Add a status comment marker so we can recognize our own comment later, that way we can edit it
    commentText += STATUS_COMMENT_MARKER;

    return commentText;
  }
}

function capitalize(str: string) {
  if (!str || str.length <= 0) {
    return false;
  }
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Satisfaction is a satisfaction summary of multiple statuses of checks/runs.
// Its statuses map maps a commit/pr reference to its success state (true/false) OR an error message
class Satisfaction {
  public satisfied: boolean;
  public commentText: string;
  public statuses: Map<Reference, boolean | string>;

  constructor(text: string, statuses: Map<Reference, boolean | string>) {
    this.commentText = text;
    this.statuses = statuses;

    // We are satisfied when all statuses are satisfied, aka all statuses are true (no blockers, no errors)
    this.satisfied = Array.from(statuses.values()).every(
      (status) => status === true
    );
  }
}
