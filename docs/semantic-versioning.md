# Pull request labels and releases

The shared release workflow runs after a pull request is merged into `main`. The labels on that pull request determine the version bump:

| Pull request label | Version change |
| --- | --- |
| `upgrade`, `breaking`, or `major` | Major |
| `enhancement`, `improvement`, `feature`, `dependencies`, or `minor` | Minor |
| `bug`, `documentation`, `docs`, `refactor`, `tests`, or no version label | Patch |

Unless the PR has the `release` label, the workflow creates a prerelease tag such as `v1.4.0-rc.1`. A PR labeled `release` promotes the latest pending prerelease to a stable tag, such as `v1.4.0`. If there is no pending prerelease, it makes a stable version bump based on the PR's other labels.

Repositories can call `.github/workflows/release.yml` from their PR-closed workflow and pass their package or project name. The release workflow then creates a GitHub Release and sends the `tag-created` dispatch so consumers such as GHCR publishers can build the exact version tag.
