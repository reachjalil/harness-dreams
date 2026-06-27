# Contributing

## Branch Model

- `main` is production-ready and should only receive reviewed pull requests.
- `develop` is the integration branch for work that is ready to combine before release.
- Feature work starts from `develop` and uses `feature/<short-description>`.
- Fix work starts from the branch that contains the bug and uses `fix/<short-description>`.
- Repository maintenance uses `chore/<short-description>`.

## Daily Flow

```bash
git fetch origin
git switch develop
git pull --ff-only origin develop
git switch -c feature/my-change
```

Before opening a pull request:

```bash
pnpm check
pnpm lint
pnpm test
```

Open feature pull requests into `develop`. Open release or hotfix pull requests
from `develop` into `main`.

## Pull Request Expectations

- Keep PRs focused on one behavior or concern.
- Include verification steps in the PR description.
- Prefer squash merging feature branches so `develop` stays readable.
- Delete feature branches after merge.
