# Security, Privacy, and Compliance

Health-style apps handle personal data. Electron also expands the attack surface. Treat security and privacy as product features.

## Electron security baseline

Required defaults:

```ts
webPreferences: {
  preload,
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  webSecurity: true,
}
```

Required policies:

- Load only trusted local app assets or HTTPS resources.
- Use a restrictive Content Security Policy.
- Do not expose raw Electron APIs.
- Validate IPC sender and payloads.
- Use permission request handlers.
- Block or validate navigation/new windows.
- Validate `shell.openExternal` URLs.
- Keep Electron current.
- Avoid `webview` unless absolutely necessary.
- Use custom protocols carefully.

## Typed IPC pattern

Bad:

```ts
contextBridge.exposeInMainWorld('electron', { ipcRenderer });
```

Good:

```ts
contextBridge.exposeInMainWorld('platform', {
  openHealthImportFile: () => ipcRenderer.invoke('file:open-health-import'),
  setDockBadge: (count: number) => ipcRenderer.invoke('dock:set-badge', { count }),
});
```

In main:

```ts
ipcMain.handle('dock:set-badge', (event, payload) => {
  assertTrustedSender(event.senderFrame);
  const count = parseNonNegativeInteger(payload.count, { max: 999 });
  app.setBadgeCount(count);
});
```

## External links

Only allow `https:` and known hosts unless the user explicitly confirms.

```ts
function assertSafeExternalUrl(raw: string): string {
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error('Only HTTPS links are allowed');
  return url.toString();
}
```

## Content Security Policy

Start strict:

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'">
```

Tighten `connect-src` to known domains before release.

## Privacy model

Minimum required user controls:

- local-only mode;
- import preview;
- source deletion;
- export all user data;
- clear all local data;
- cloud sync opt-in;
- source/provenance visibility;
- recommendation opt-out;
- telemetry opt-in or no telemetry.

## Sensitive data handling

Do:

- minimize stored fields;
- store source provenance;
- encrypt secrets/tokens;
- keep health samples local by default;
- separate raw import files from normalized records;
- provide deletion that includes derived artifacts.

Do not:

- upload imports automatically;
- include sensitive data in logs;
- send samples to an LLM without explicit consent;
- keep raw imports after deletion;
- use third-party analytics on health screens without review.

## Medical/legal safety

Avoid diagnosis. Use neutral language:

- “Your data shows...”
- “Compared with your recent baseline...”
- “Consider reviewing this with a professional...”

Do not say:

- “You have...”
- “This means you are sick...”
- “This treatment will...”

Any medical, clinical, therapeutic, or regulated use case needs expert review beyond this skill.

## Security review checklist

- [ ] No raw `ipcRenderer` exposure.
- [ ] No `nodeIntegration` in renderer.
- [ ] `contextIsolation` enabled.
- [ ] `sandbox` enabled.
- [ ] CSP present in production.
- [ ] Navigation/new-window restrictions implemented.
- [ ] External links validated.
- [ ] IPC payload validation and sender checks.
- [ ] Secure storage only for secrets.
- [ ] Large import parsing outside renderer.
- [ ] Logs scrub sensitive data.
- [ ] Dependencies audited.
- [ ] Build signed/notarized.
- [ ] Update channel secured.
