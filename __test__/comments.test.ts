import { LandAfterCommand } from "../src/comment";
import { Reference } from "../src/git";
import { expect, test } from "@jest/globals";

test("ref parse commit", () => {
  var ref: Reference;

  expect(
    (ref = Reference.parse("7057a654720ef532ad11f920e57a33f59890d702 in main"))
  ).toEqual({
    commitHash: "7057a654720ef532ad11f920e57a33f59890d702",
    commitBranch: "main",
  });
  expect(ref.toString()).toEqual(
    "commit 7057a654720ef532ad11f920e57a33f59890d702 must be merged into the main branch of this repository"
  );

  expect(
    (ref = Reference.parse(
      "other/repo#7057a654720ef532ad11f920e57a33f59890d702"
    ))
  ).toEqual({
    repoSlug: "other/repo",
    commitHash: "7057a654720ef532ad11f920e57a33f59890d702",
  });
  expect(ref.toString()).toEqual(
    "commit other/repo@7057a654720ef532ad11f920e57a33f59890d702 must be merged into the default branch of its repository"
  );

  expect(
    (ref = Reference.parse(
      "other/repo@7057a654720ef532ad11f920e57a33f59890d702"
    ))
  ).toEqual({
    repoSlug: "other/repo",
    commitHash: "7057a654720ef532ad11f920e57a33f59890d702",
  });
  expect(ref.toString()).toEqual(
    "commit other/repo@7057a654720ef532ad11f920e57a33f59890d702 must be merged into the default branch of its repository"
  );

  expect(
    (ref = Reference.parse(
      "other/repo#7057a654720ef532ad11f920e57a33f59890d702 in develop"
    ))
  ).toEqual({
    repoSlug: "other/repo",
    commitHash: "7057a654720ef532ad11f920e57a33f59890d702",
    commitBranch: "develop",
  });
  expect(ref.toString()).toEqual(
    "commit other/repo@7057a654720ef532ad11f920e57a33f59890d702 must be merged into the develop branch of its repository"
  );

  expect(
    (ref = Reference.parse(
      "other/repo@7057a654720ef532ad11f920e57a33f59890d702 in develop"
    ))
  ).toEqual({
    repoSlug: "other/repo",
    commitHash: "7057a654720ef532ad11f920e57a33f59890d702",
    commitBranch: "develop",
  });
  expect(ref.toString()).toEqual(
    "commit other/repo@7057a654720ef532ad11f920e57a33f59890d702 must be merged into the develop branch of its repository"
  );

  expect(
    (ref = Reference.parse(
      "https://github.com/xarantolus/action-autoland/commit/7057a654720ef532ad11f920e57a33f59890d702"
    ))
  ).toEqual({
    repoSlug: "xarantolus/action-autoland",
    commitHash: "7057a654720ef532ad11f920e57a33f59890d702",
  });
  expect(ref.toString()).toEqual(
    "commit xarantolus/action-autoland@7057a654720ef532ad11f920e57a33f59890d702 must be merged into the default branch of its repository"
  );

  expect(
    (ref = Reference.parse(
      "https://github.com/xarantolus/action-autoland/commit/7057a654720ef532ad11f920e57a33f59890d702 in dev"
    ))
  ).toEqual({
    repoSlug: "xarantolus/action-autoland",
    commitHash: "7057a654720ef532ad11f920e57a33f59890d702",
    commitBranch: "dev",
  });
  expect(ref.toString()).toEqual(
    "commit xarantolus/action-autoland@7057a654720ef532ad11f920e57a33f59890d702 must be merged into the dev branch of its repository"
  );

  expect(
    (ref = Reference.parse("#7057a654720ef532ad11f920e57a33f59890d702"))
  ).toEqual({
    commitHash: "7057a654720ef532ad11f920e57a33f59890d702",
  });
  expect(ref.toString()).toEqual(
    "commit 7057a654720ef532ad11f920e57a33f59890d702 must be merged into the default branch of this repository"
  );

  expect(
    (ref = Reference.parse("@7057a654720ef532ad11f920e57a33f59890d702"))
  ).toEqual({
    commitHash: "7057a654720ef532ad11f920e57a33f59890d702",
  });
  expect(ref.toString()).toEqual(
    "commit 7057a654720ef532ad11f920e57a33f59890d702 must be merged into the default branch of this repository"
  );

  expect(
    (ref = Reference.parse("7057a654720ef532ad11f920e57a33f59890d702"))
  ).toEqual({
    commitHash: "7057a654720ef532ad11f920e57a33f59890d702",
  });
  expect(ref.toString()).toEqual(
    "commit 7057a654720ef532ad11f920e57a33f59890d702 must be merged into the default branch of this repository"
  );

  expect(
    (ref = Reference.parse(
      "https://github.com/xarantolus/action-autoland/pull/2/commits/8bd5cf32e6094213d80eac4d3176ca9b75b884a7"
    ))
  ).toEqual({
    repoSlug: "xarantolus/action-autoland",
    commitHash: "8bd5cf32e6094213d80eac4d3176ca9b75b884a7",
  });
  expect(ref.toString()).toEqual(
    "commit xarantolus/action-autoland@8bd5cf32e6094213d80eac4d3176ca9b75b884a7 must be merged into the default branch of its repository"
  );
});

test("ref parse pr/issue", () => {
  var ref: Reference;

  expect((ref = Reference.parse("#15"))).toEqual({
    issueNumber: 15,
  });
  expect(ref.toString()).toEqual("PR/Issue #15 must be closed (or deleted)");

  expect((ref = Reference.parse("other/repo#15"))).toEqual({
    repoSlug: "other/repo",
    issueNumber: 15,
  });
  expect(ref.toString()).toEqual(
    "PR/Issue other/repo#15 must be closed (or deleted)"
  );

  expect(
    (ref = Reference.parse(
      "https://github.com/xarantolus/test-action-repo/pull/1"
    ))
  ).toEqual({
    repoSlug: "xarantolus/test-action-repo",
    issueNumber: 1,
  });
  expect(ref.toString()).toEqual(
    "PR/Issue xarantolus/test-action-repo#1 must be closed (or deleted)"
  );

  expect(
    (ref = Reference.parse(
      "https://github.com/xarantolus/test-action-repo/issues/2"
    ))
  ).toEqual({
    repoSlug: "xarantolus/test-action-repo",
    issueNumber: 2,
  });
  expect(ref.toString()).toEqual(
    "PR/Issue xarantolus/test-action-repo#2 must be closed (or deleted)"
  );
});

test("throw errors for invalid refs", () => {
  expect(() => Reference.parse("")).toThrowError();
  expect(() => Reference.parse("x#5")).toThrowError();
  expect(() => Reference.parse("#0.5")).toThrowError();
  expect(() => Reference.parse("a/b#notacommithash")).toThrowError();
  expect(() => Reference.parse("user/repo")).toThrowError();
});

test("parse simple comment", () => {
  expect(
    LandAfterCommand.parse(`Seems like this PR is blocked by xarantolus/action-autoland#15.
  
  I will also mention another unrelated PR that nobody cares/about#18

  autoland after xarantolus/action-autoland#15
  `)
  ).toEqual({
    dependencies: [new Reference("xarantolus/action-autoland", 15)],
  });

  expect(
    LandAfterCommand.parse(`Seems like this PR is blocked by xarantolus/action-autoland#15.
  
  autoland after xarantolus/action-autoland#15, xarantolus/action-autoland#16
  `)
  ).toEqual({
    dependencies: [
      new Reference("xarantolus/action-autoland", 15),
      new Reference("xarantolus/action-autoland", 16),
    ],
  });

  expect(
    LandAfterCommand.parse(`Seems like this PR is blocked by xarantolus/action-autoland#15.
  
  autoland after xarantolus/action-autoland#15, xarantolus/action-autoland#16

  But i wrote it twice:
  autoLand afTer xarantolus/action-autoland#15, other/repo@7057a654720ef532ad11f920e57a33f59890d702 in dev, other/repo@7057a654720ef532ad11f920e57a33f59890d703, xarantolus/action-autoland#76


  `)
  ).toEqual({
    dependencies: [
      new Reference("xarantolus/action-autoland", 15),
      new Reference("xarantolus/action-autoland", 16),
      new Reference(
        "other/repo",
        undefined,
        "7057a654720ef532ad11f920e57a33f59890d702",
        "dev"
      ),
      new Reference(
        "other/repo",
        undefined,
        "7057a654720ef532ad11f920e57a33f59890d703"
      ),
      new Reference("xarantolus/action-autoland", 76),
    ],
  });

  expect(
    LandAfterCommand.parse(`We need a bunch of commits and PRs before this can be merged:

    From our org:
      autoland after 7057a654720ef532ad11f920e57a33f59890d702 in main, required/repo#15

    External:autoLAND afTer xarantolus/action-autoland#25, xarantolus/action-autoland#e57a33f5989, xarantolus/action-autoland#e57a33f5989 in develop

  `)
  ).toEqual({
    dependencies: [
      new Reference(
        undefined,
        undefined,
        "7057a654720ef532ad11f920e57a33f59890d702",
        "main"
      ),
      new Reference("required/repo", 15),
      new Reference("xarantolus/action-autoland", 25),
      new Reference("xarantolus/action-autoland", undefined, "e57a33f5989"),
      new Reference(
        "xarantolus/action-autoland",
        undefined,
        "e57a33f5989",
        "develop"
      ),
    ],
  });

  expect(
    LandAfterCommand.parse(`

    autoland after e01cbf3ee, #9

  `)
  ).toEqual({
    dependencies: [
      new Reference(undefined, undefined, "e01cbf3ee"),
      new Reference(undefined, 9),
    ],
  });

  expect(
    LandAfterCommand.parse(
      `autoland after 506d44f, #3, xarantolus/action-autoland@fa6a4e7`
    )
  ).toEqual({
    dependencies: [
      new Reference(undefined, undefined, "506d44f"),
      new Reference(undefined, 3),
      new Reference("xarantolus/action-autoland", undefined, "fa6a4e7"),
    ],
  });
});

test("parse within sentence in comment", () => {
  expect(
    LandAfterCommand.parse(
      `This PR fixes #7 and should autoland after 506d44f, #3, xarantolus/action-autoland@fa6a4e7. #9 should be worked on after this.`
    )
  ).toEqual({
    dependencies: [
      new Reference(undefined, undefined, "506d44f"),
      new Reference(undefined, 3),
      new Reference("xarantolus/action-autoland", undefined, "fa6a4e7"),
    ],
  });

  expect(
    LandAfterCommand.parse(
      `This PR fixes #7 and should autoland after 506d44f, #3, xarantolus/action-autoland@fa6a4e7! #9 should be worked on after this.`
    )
  ).toEqual({
    dependencies: [
      new Reference(undefined, undefined, "506d44f"),
      new Reference(undefined, 3),
      new Reference("xarantolus/action-autoland", undefined, "fa6a4e7"),
    ],
  });
});
