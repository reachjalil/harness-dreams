# 20 · Privacy & Security

*Status: 🟢 Locked (principles) / 🟡 Draft (mechanisms)*

Harness Dreams reads the most sensitive data a developer has: full transcripts of
their coding sessions, including source code, file paths, commands, and
potentially secrets. Privacy is not a feature here — it's the license to operate.
These principles are **locked**; the mechanisms that implement them are draft.

## Principles (locked)

1. **Local-first.** All raw data stays on the user's machine. Ingestion,
   storage, and Deep Sleep are 100% local and work offline.
2. **Cloud is opt-in and minimal.** The only egress is the REM LLM call, and only
   if the user enables it. It sends **redacted excerpts**, not whole transcripts.
3. **No telemetry of user content. Ever.** We do not phone home with the user's
   code, prompts, metrics, or usage. (Optional, clearly-labeled, content-free
   product analytics could be considered later — off by default.)
4. **Consent for every write.** Nothing is written to the user's config/memory
   without a previewed diff and explicit approval, with a backup and undo.
5. **Never write or transmit secrets.** `.env`, credentials, ignored files, and
   detected secrets are excluded from egress and never written.
6. **User owns and can purge everything.** One action wipes the normalized store
   and all derived artifacts.

## Data classification

| Data | Sensitivity | Handling |
|---|---|---|
| Raw transcripts (`~/.claude/**`) | high (code+secrets) | read in place, local only; pointers stored, bodies retained only if user opts in |
| Normalized events/metrics | medium | local SQLite; numbers + pointers, minimal text |
| Redacted REM excerpts | medium | only data sent to cloud, only if cloud REM is on |
| Findings/experiments/reports | medium | local; reference evidence by pointer |
| Config/memory files | high | written only on consent, with backups |
| Secrets / `.env` / credentials | critical | never read into egress, never written, never displayed in full |

## Redaction layer (for cloud REM)

When cloud REM is enabled, the `llm` package runs every excerpt through
redaction **before** any network call:

- **Secret scanning**: detect API keys, tokens, private keys, connection strings,
  high-entropy strings → replace with typed placeholders (`<SECRET:aws_key>`).
- **Path/identity minimization**: optionally hash or relativize absolute paths
  and usernames.
- **Excerpt minimization**: send the **smallest** span needed for the finding
  (the engine cites event IDs; only the cited spans are sent), not whole files.
- **Allowlist of fields**: only fields needed for analysis leave the machine;
  raw `content` is summarized/snippetized, not shipped wholesale.
- **Preview**: settings show *exactly* what a redacted excerpt looks like before
  the user enables cloud REM. No surprises.

If redaction can't confidently clean a span, it's **dropped, not sent**.

## Local-only mode

A first-class mode where **no data ever leaves the device**:
- Deep Sleep (all vitals/trends) works fully.
- REM either (a) runs against a **local model** (e.g. Ollama) — future, or (b) is
  disabled, leaving a vitals-and-trends-only report.
- This must be a viable, clearly-supported configuration, not a degraded
  afterthought — some users will never enable cloud.

## Secret handling specifics

- Secrets are excluded at **three** layers: ingestion (don't retain), evidence
  display (mask), and egress (scan + drop).
- We honor the repo's `.gitignore`/`.env` conventions as a hint for "do not
  touch."
- Config writes (`09`) explicitly refuse to write to ignored/secret files.

## Threat model (brief)

| Threat | Mitigation |
|---|---|
| Secret leakage to cloud | redaction + drop-on-doubt + local-only mode |
| Malicious/compromised config write | diff + consent + backup + undo; marked blocks |
| Local store theft | OS-level disk encryption assumed; option to encrypt the store; easy purge |
| Prompt injection via transcript content | REM treats transcript text as **data, not instructions**; structured outputs; no tool execution from REM |
| Over-broad file access | request least privilege; explain; scope to harness dirs |
| Supply-chain (deps) | minimal deps, lockfile, review; no remote code execution from analysis |

## Security posture

- The analysis pipeline **never executes** code/commands found in transcripts.
- Config writes are constrained to known artifact types/paths and always
  reversible.
- The app is signed/notarized (`18`); updates are signed.
- No inbound network surface (no server, no listening port).

## What the user sees & controls

- A clear privacy choice at onboarding (local-only vs cloud REM).
- A redaction preview.
- Per-setting toggles: raw-text retention, path minimization, cloud REM, product
  analytics (off by default).
- One-click **purge all data** and **revert all changes**.
