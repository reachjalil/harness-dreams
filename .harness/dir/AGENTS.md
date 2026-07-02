# Agent Guidance

<!-- harness-health:start -->
## Harness Health — accepted guidance

Apply these user-approved recommendations from the latest Health Review:

- Use `develop` as the integration branch for upcoming work. Create feature branches from `develop` using `feature/<short-description>`. Merge completed feature work back into `develop` first, then promote `develop` to `main` only after validation passes.

## Harness config maintenance

Durable agent configuration is owned by `.harness` source. For changes to Codex
or Claude agent config, edit `.harness/dir`, `.harness/resources`, or package
`.harness/resources` sources first, then run `pnpm harness:validate`,
`pnpm harness:preview`, and `pnpm harness:activate` to project generated
surfaces.
<!-- harness-health:end -->
