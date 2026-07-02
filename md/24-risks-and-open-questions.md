# 24 · Risks & Open Questions

*Status: 🟡 Draft — living list*

The honest list of what could sink this, what we don't yet know, and the bets
that need validating early. Grouped by type. Each item notes a mitigation or the
phase/spike that resolves it.

## Product risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| **Findings aren't good enough** | If Insight produces generic or wrong insights, nobody opens the report twice | Phase 0 spike against real data; strict evidence grounding + confidence filtering (`15`); cap to a few high-confidence items |
| **Not worth the daily habit** | The whole thesis is the morning ritual | Lead with one strong digest + rings; "quiet night" is allowed; never manufacture insights (`19`) |
| **Experiments feel like noise** | False certainty or trivial tips erode trust | Three-bucket verdicts + uncertainty + pre-registration; personalize templates from real data (`16`) |
| **Too much UI / overwhelm** | A health app must feel calm | Hard caps on findings/experiments; summary→detail (`06`,`19`) |

## Technical risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| **Small-sample statistics** | Personal experiments have tiny N; naive stats mislead | Effect-size-first + intervals + "inconclusive" as a real outcome (`16`); spike in Phase 0 |
| **Accepted-change / re-ask detection** | Core metrics depend on classifiers that are non-trivial | Start with conservative heuristics + `file-history`; refine in Phase 2 (`13`) |
| **Harness format drift** | Transcript schema can change across versions | Versioned connectors; preserve unknown fields; skip-and-log bad lines (`14`) |
| **Behavior-change reliability** | Instruction injection may not reliably change behavior | Start with the lowest-risk lever + manual-nudge fallback; measure compliance (`16`) |
| **Tauri sidecar/Node ergonomics** | Could complicate engine execution | ADR-005 sidecar; Electron fallback ADR-002 keeps engine identical |
| **Cost of overnight reviews** | LLM spend could be uncomfortable | Per-review budget guard; cheap Deterministic Vitals does the heavy lifting; tier models (`15`) |

## Privacy/trust risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| **Secret leakage to cloud** | Catastrophic for trust | Redaction + drop-on-doubt + local-only mode + preview (`20`) |
| **Unwanted config writes** | Touching someone's repo is high-stakes | Diff + consent + backup + undo + marked blocks (`09`,`16`,`20`) |
| **Prompt injection via transcripts** | Transcript content could try to steer Insight | Treat content as data, not instructions; structured outputs; no execution from Insight (`20`) |

## Open questions (need a decision)

1. **Review window for irregular schedules.** How to define "yesterday" for
   someone who codes at 3am? (Activity-gap segmentation vs fixed clock.) — *Phase
   1.*
2. **Per-harness vs unified report.** Leaning unified with per-harness sections;
   confirm with the first multi-connector build. — *Phase 3.*
3. **Local-model Insight viability.** Which local models are good enough for findings,
   and at what latency/footprint? — *spike before Phase 4.*
4. **Pricing table source.** Per-model/tier prices for `cost.*` — pull live from
   the Claude API reference; how to keep current for non-Claude harnesses? —
   *Phase 0/3.*
5. **"Satisfaction" proxy validity.** Are follow-up/correction signals a
   trustworthy proxy for user satisfaction, or do we need explicit feedback
   (thumbs)? — *Phase 2; consider a lightweight in-report 👍/👎 to calibrate.*
6. **Codex/Cursor data formats.** Exact on-disk locations/schemas. — *confirm at
   Phase 3 connector work.*
7. **Idle/idle trigger semantics on macOS.** Reliable detection of "harness
   asleep" without false positives. — *Phase 1.*
8. **Distribution & updates.** DMG + notarization first; Homebrew later; updater
   choice (`22`). — *Phase 1.*

## Assumptions to validate

- The owner's machine (26 projects, multiple harnesses) is representative enough
  to design against. *(High confidence — it's the literal target user.)*
- Claude Code's local telemetry is rich enough for meaningful vitals.
  *(Validated structurally in `14`; quality TBD in Phase 0.)*
- Users will grant read access to `~/.claude/**`. *(Onboarding must earn this;
  local-first framing helps.)*
- A few high-confidence findings/night is more valuable than exhaustive analysis.
  *(Design principle; validate with real use.)*

## Things explicitly NOT decided yet

- Monetization (the docs assume a local app; pricing/business model is out of
  scope here).
- Branding/visual identity specifics beyond "Apple-Health-like."
- Whether to ever add optional, content-free product analytics (off by default
  if so).
