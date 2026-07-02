# Testing and Quality Checklist

Electron/web health-style apps need tests across domain logic, UI components, native shell, import pipelines, and packaging.

## Test layers

### Domain tests

Use Vitest for:

- ring math;
- badge rule evaluation;
- trend detection;
- recommendation confidence;
- unit normalization;
- import deduplication;
- source deletion effects.

### Component tests

Use Vitest + React Testing Library for:

- metric cards;
- ring accessible labels;
- badge grid keyboard navigation;
- recommendation cards;
- sidebar selection;
- toolbar controls;
- import status states.

### Accessibility tests

Use axe/jest-axe as a regression helper, not as a guarantee.

Manual checks still required:

- keyboard-only navigation;
- VoiceOver on macOS;
- focus order;
- color contrast;
- reduced motion;
- high contrast;
- chart text summaries.

### Browser E2E tests

Use Playwright for:

- web routes;
- import via file input;
- offline shell behavior;
- responsive layouts;
- dark mode screenshot checks;
- PWA service worker smoke tests.

### Electron E2E tests

Use Playwright Electron support for focused smoke tests:

- app launches;
- main window appears without white flash;
- Summary route renders;
- menu item opens import dialog handler;
- theme bridge emits state;
- settings route opens;
- no dev menu in production build.

Keep Electron E2E tests small and stable.

### Native/manual macOS checks

- traffic lights position;
- full screen behavior;
- toolbar dragging/no-drag controls;
- app menu roles;
- `Cmd+,` opens settings;
- `Cmd+Q`, `Cmd+W`, `Cmd+M` behavior;
- dark mode follows system;
- notifications work in signed build;
- dock badge clears;
- file dialogs open expected file types;
- signed/notarized app launches without Gatekeeper warnings.

## Performance checks

- large import does not block UI;
- dashboard renders within acceptable time for 1, 5, and 10 years of samples;
- ring animation does not jank during resize;
- charts virtualize or aggregate large data;
- memory after import returns to reasonable baseline;
- PWA offline cache does not store sensitive API data unintentionally.

## Quality gates

Before handoff:

- [ ] Reference map included.
- [ ] Electron security checklist passed.
- [ ] Web/PWA feature gates implemented.
- [ ] macOS native shell checklist passed.
- [ ] Apple brand safety checklist passed.
- [ ] Data export/delete path tested.
- [ ] Large import tested.
- [ ] Accessibility checks done.
- [ ] Signed/notarized release plan documented.
- [ ] User-facing privacy copy drafted.
