# harness-dreams

A pnpm + Turborepo monorepo centralizing work and shared IP under the
`@harness-dreams/*` scope.

## Current status

Harness Dreams is in active local development. There is not a signed macOS app
download or public hosted sign-up flow yet. Both are coming soon.

For now, run the desktop app from source:

```bash
git clone https://github.com/reachjalil/harness-dreams.git
cd harness-dreams
corepack enable
pnpm install
pnpm --filter @harness-dreams/desktop start
```

Requirements: macOS, Node.js 22.12 or newer, and pnpm. Corepack will use the
pnpm version pinned by this repo.

## Stack

- **Package manager:** pnpm (workspaces + catalogs)
- **Task runner:** Turborepo
- **Lint / format:** Biome
- **Versioning / publishing:** Changesets
- **Language:** TypeScript

## Layout

```
packages/   # shared, reusable libraries (@harness-dreams/*)
apps/       # deployable applications and services
```

## Getting started

```bash
pnpm install     # install all workspace dependencies
pnpm check       # typecheck across the workspace
pnpm lint        # biome lint + format check
pnpm build       # build all packages via turbo
pnpm test        # run tests
```

## Adding a package

Create a directory under `packages/` (library) or `apps/` (application) with a
`package.json` named `@harness-dreams/<name>`. Pin shared dependency versions
through the catalog in `pnpm-workspace.yaml` (`"dep": "catalog:"`).

## Versioning

This repo uses [Changesets](https://github.com/changesets/changesets):

```bash
pnpm changeset        # describe a change
pnpm version          # apply version bumps
pnpm release          # build + publish
```
