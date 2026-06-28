# @harness-dreams/desktop

Native macOS menu-bar app for Harness Dreams.

## Current status

The desktop app is not distributed as a signed macOS download yet. Sign-up,
early access invites, and the signed app build are coming soon.

Until then, run it locally from the repo:

```bash
git clone https://github.com/reachjalil/harness-dreams.git
cd harness-dreams
corepack enable
pnpm install
pnpm --filter @harness-dreams/desktop start
```

This starts the Electron app in development mode.
