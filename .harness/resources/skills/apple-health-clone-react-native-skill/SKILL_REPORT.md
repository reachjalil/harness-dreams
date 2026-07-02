# Skill Report — apple-health-clone-react-native-skill

Generated: 2026-06-28

## What changed

Created a new packaged skill:

- `apple-health-clone-react-native-skill/SKILL.md`
- `apple-health-clone-react-native-skill/README.md`
- `apple-health-clone-react-native-skill/SOURCES.md`
- `apple-health-clone-react-native-skill/SKILL_REPORT.md`
- `apple-health-clone-react-native-skill/reference/*.md`
- `apple-health-clone-react-native-skill/examples/*`
- `apple-health-clone-react-native-skill/research/source-catalog.json`
- `apple-health-clone-react-native-skill/research/repo-scorecard.csv`

## Audit notes

- Frontmatter present: yes.
- `name` matches folder: yes.
- `description` present: yes.
- Description contains `Use when`: yes.
- Description contains `Do NOT use`: yes.
- `## Inputs` present: yes.
- `## Outputs` present: yes.
- `## Workflow` present: yes.
- `## Quality Checklist` present: yes.
- `## References` present: yes.

## Research summary

The skill focuses on a composable reference strategy rather than a single clone repo. Current open-source coverage is strongest when separated by subsystem:

- HealthKit bridge: `@kingstinct/react-native-healthkit`.
- Established HealthKit fallback: `react-native-health`.
- Watch bridge: `react-native-watch-connectivity`.
- Full app architecture reference: `skulptapp/skulpt`.
- Rings prototype reference: `react-native-activity-rings`.
- Custom ring rendering: React Native Skia.
- Charts: Victory Native XL.
- Android parity: React Native Health Connect.

## Remaining backlog

- Re-run source review before implementation because RN, Expo, Nitro Modules, Xcode, iOS, and watchOS compatibility can shift quickly.
- Validate the chosen HealthKit library inside the target app template before committing architecture.
- Build a real Skia ring renderer spike on device.
- Build a minimal SwiftUI Watch companion spike with WatchConnectivity before final UI design.
- Perform legal/design review before using Apple Health badge or Apple Health icon references.
