# Claude Guidance

<!-- harness-health:claude:start -->
## Harness Health — Claude guidance

Apply these user-approved recommendations from the latest Health Review:

- [claudemd] Add rule: ## Validation
- Run `pnpm install` to install dependencies.
- Run `pnpm lint` to check formatting and linting.
- Run `pnpm check` to typecheck.
- Run `pnpm test` to run the test suite.
- Run `pnpm build` to build all packages.
- Verify all commands pass before committing.

## Harness config maintenance

Durable Claude and shared agent configuration is owned by `.harness` source.
For changes to agent instructions, skills, rules, launch config, or generated
agent targets, edit `.harness/dir`, `.harness/resources`, or package
`.harness/resources` sources first, then run `pnpm harness:validate`,
`pnpm harness:preview`, and `pnpm harness:activate`.
<!-- harness-health:claude:end -->
