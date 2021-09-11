import { Reference, LandAfterCommand } from "../src/comment";
import { expect, test } from "@jest/globals";

test("ref parsing correctness", () => {
  expect(Reference.parse("#15")).toEqual({
    issueNumber: 15,
  });

  expect(Reference.parse("user/repo")).toEqual({
    repoSlug: "user/repo",
  });

  expect(Reference.parse("other/repo#15")).toEqual({
    repoSlug: "other/repo",
    issueNumber: 15,
  });

  expect(Reference.parse("other/repo#15")).toEqual({
    repoSlug: "other/repo",
    issueNumber: 15,
  });

  expect(
    Reference.parse("https://github.com/xarantolus/test-action-repo/pull/1")
  ).toEqual({
    repoSlug: "xarantolus/test-action-repo",
    issueNumber: 1,
  });

  expect(
    Reference.parse("other/repo#7057a654720ef532ad11f920e57a33f59890d702")
  ).toEqual({
    repoSlug: "other/repo",
    commitHash: "7057a654720ef532ad11f920e57a33f59890d702",
  });

  expect(
    Reference.parse(
      "https://github.com/xarantolus/action-autoland/commit/7057a654720ef532ad11f920e57a33f59890d702"
    )
  ).toEqual({
    repoSlug: "xarantolus/action-autoland",
    commitHash: "7057a654720ef532ad11f920e57a33f59890d702",
  });

  expect(Reference.parse("#7057a654720ef532ad11f920e57a33f59890d702")).toEqual({
    commitHash: "7057a654720ef532ad11f920e57a33f59890d702",
  });

  expect(Reference.parse("7057a654720ef532ad11f920e57a33f59890d702")).toEqual({
    commitHash: "7057a654720ef532ad11f920e57a33f59890d702",
  });
});

test("parsing invalid refs", () => {
  expect(() => Reference.parse("")).toThrowError();
  expect(() => Reference.parse("x#5")).toThrowError();
  expect(() => Reference.parse("#0.5")).toThrowError();
  expect(() => Reference.parse("a/b#notacommithash")).toThrowError();
});


test("parse whole comment", () => {
  expect(LandAfterCommand.parse(`Seems like this PR is blocked by xarantolus/action-autoland#15.
  
  I will also mention another unrelated PR that nobody cares/about#18

  autoland after xarantolus/action-autoland#15
  `)).toEqual({
    dependencies: [
      new Reference("xarantolus/action-autoland", 15)
    ]
  })


  expect(LandAfterCommand.parse(`Seems like this PR is blocked by xarantolus/action-autoland#15.
  
  autoland after xarantolus/action-autoland#15, xarantolus/action-autoland#16
  `)).toEqual({
    dependencies: [
      new Reference("xarantolus/action-autoland", 15),
      new Reference("xarantolus/action-autoland", 16)
    ]
  })

  expect(LandAfterCommand.parse(`Seems like this PR is blocked by xarantolus/action-autoland#15.
  
  autoland after xarantolus/action-autoland#15, xarantolus/action-autoland#16

  But i wrote it twice:
  autoLand afTer xarantolus/action-autoland#15, xarantolus/action-autoland#76


  `)).toEqual({
    dependencies: [
      new Reference("xarantolus/action-autoland", 15),
      new Reference("xarantolus/action-autoland", 16),
      new Reference("xarantolus/action-autoland", 76)
    ]
  })
});
