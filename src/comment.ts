import { Reference } from './git';

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
    const regex = /autoland after (.+)/gi;

    var references: Reference[] = [];

    let m;

    while ((m = regex.exec(body)) !== null) {
      // This is necessary to avoid infinite loops with zero-width matches
      if (m.index === regex.lastIndex) {
        regex.lastIndex++;
      }

      // The result can be accessed through the `m`-variable.
      this.parseInner(m[1]).forEach((r) => {
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
}
