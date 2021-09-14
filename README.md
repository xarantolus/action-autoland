# autoland
autoland is a Github Action that allows you to automatically merge pull requests when another repository merges a pull request or commit.

### How it works:
1. You or someone else creates a pull request on your own repository
2. Include the text `autoland after other/repo#12` in the pull request text or just add it as a comment
3. The bot will comment a status report on your PR to show you which conditions are met and which ones are blocking the merge
4. Some time after the referenced pull request is merged, autoland will merge your PR if all other status checks are successful (or were skipped/neutral)

This also works for commits, they will be merged as soon as they are in the specified branch (defaults to the default branch of the repository).

### Setup & Configuration
**WARNING**: This is not yet ready for general use, except if you want to test. Adding this action to your repository could allow an attacker to merge their own PR, which is a security risk.

1. Create a new workflow file in your repository, e.g. at `.github/workflows/autoland.yml` (or just go to the Actions tab and create a new file from there).
2. Paste the following content:
```yml
name: Auto-Merge PRs

# These are the events the job needs to listen for in order to merge pull requests
on:
  # It checks if a single pull request has new criteria for merging (via "autoland after ..." comments)
  pull_request:
  issue_comment:
  pull_request_review:
  pull_request_review_comment:

  # It also wants to know when pull requests are ready for merging
  check_suite:
  check_run:
    types: [completed]

  # Periodically check if external repositories have merged the PRs that ours depend on
  schedule:
    - cron: "30 */2 * * *"

  # You can also run the check manually
  workflow_dispatch:

jobs:
  auto-merge:
    name: Autoland Pull Request
    runs-on: ubuntu-latest
    steps:
      - uses: xarantolus/action-autoland@main
        with:
          # How PRs should be merged
          #   Allowed values are 'merge', 'squash' or 'rebase'
          #   See https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/about-merge-methods-on-github
          merge-method: merge 
          # Which user types are allowed to comment "autoland after" comments (other users are ignored), separated by comma
          #   See https://docs.github.com/en/graphql/reference/enums#commentauthorassociation
          users: owner, collaborator, member
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

3. Commit & push the file

Now you can comment on a pull request to make it depend on another commit or pull request (or issue) that has not yet been merged.

You can put the command anywhere in the pull request body or in a comment. From the first 100 comments on a PR, this action will choose **only the last comment that contains a command**. If that comment contains multiple commands, it's required that *all* conditions from all provided commands are met for the merge to be done (that's also the case for a single command with multiple dependencies).

### Comment format
This action supports formats for issues, pull requests and commits from either your own or external (GitHub) repositories.

The following command texts can be used:
* `autoland after #2`
  * Merges the PR after issue or PR `#2` is closed (also when the PR has *not* been merged, but closed)
* `autoland after https://github.com/other/repo/pull/1`
  * Merges the PR after PR `#1` of `other/repo` has been closed (again, this does not necessarily mean that it was merged)
* `autoland after other/repo@7057a654720ef532ad11f920e57a33f59890d702`
  * Merge PR after the commit with hash `7057a654720ef532ad11f920e57a33f59890d702` is present in the **default branch** of `other/repo`
* `autoland after other/repo@7057a654720ef532ad11f920e57a33f59890d702 in develop`
  * Merge PR after the commit with hash `7057a654720ef532ad11f920e57a33f59890d702` is present in the `develop` branch of `other/repo`

For convenience you can also just use the GitHub URL(s) to the item(s), e.g.
* `autoland after https://github.com/xarantolus/action-autoland/pull/2`
* `autoland after https://github.com/xarantolus/test-action-repo/issues/9`
* `autoland after https://github.com/xarantolus/action-autoland/commit/41aba18eacb739635ef58e7aace7988a92a078ec`

You can also add multiple conditions by separating them with a comma:
* `autoland after #2, other/repo#3, 7057a654720ef532ad11f920e57a33f59890d702, other/repo@7057a654720ef532ad11f920e57a33f59890d702 in develop`
  * Merges this PR when ALL of the following is true:
    * Issue/PR `#2` of this repository is closed
    * Issue/PR `#3` of the `other/repo` repository is closed
    * Commit with hash `7057a654720ef532ad11f920e57a33f59890d702` is in the default branch of this repository
    * Commit with hash `7057a654720ef532ad11f920e57a33f59890d702` is in the `develop` branch of `other/repo`

It also understands other formats, mostly GitHub URLs to commits and PRs (see [tests](__test__/comments.test.ts)). If you find that a format doesn't work, please feel free to open an issue.
