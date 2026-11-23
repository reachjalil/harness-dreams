# Claude Guidance

<!-- harness-dreams:claude:start -->
## Harness Dreams — Claude guidance

Apply these user-approved recommendations from the latest Sleep Cycle:

- [claudemd] Add rule: ## Validation
- Run `pnpm install` to install dependencies.
- Run `pnpm lint` to check formatting and linting.
- Run `pnpm check` to typecheck.
- Run `pnpm test` to run the test suite.
- Run `pnpm build` to build all packages.
- Verify all commands pass before committing.
<!-- harness-dreams:claude:end -->

## Sleep Cycle runs

- Before you run Observe or Synthesize for a date, check whether that date already has a completed Reflection. If it does, stop and report it. Do not run the step again.
- If one Observe or Synthesize run passes about 10 minutes, cancel it and report the date, the step, and the elapsed time. Two turns of summarization that take an hour is a hang, not slow work.
- After you change a prompt or an instruction, rerun the stored scenarios for every target that prompt covers and report the result for each one. A wording change that fixes the failing target and breaks a neighbouring one is not a fix.
