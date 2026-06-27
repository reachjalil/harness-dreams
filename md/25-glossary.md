# 25 · Glossary

*Status: 🟢 Locked (controlled vocabulary — use these terms consistently)*

The shared vocabulary for the product. Every other doc uses these terms exactly.
Each "dream" term has a plain-language meaning so the metaphor never obscures the
mechanics.

| Term | Plain meaning | Definition |
|---|---|---|
| **Harness** | AI coding tool | An agentic coding tool instance — Claude Code, Codex CLI, Cursor, etc. The thing we observe. |
| **Harness Dreams** | the product | The macOS menu-bar health/reflection app for harnesses. |
| **Sleep** | idle/overnight trigger | The condition (idle, scheduled, or manual) under which a dream runs. The harness isn't actively coding. |
| **Dream / Dream Session** | analysis run | One background analysis run over a window of activity. Produces a Dream Report. |
| **Dream Report** | the output | The Apple-Health-style artifact: vitals, trends, findings, experiments, memory proposals, digest. |
| **Deep Sleep** | deterministic pass | The no-LLM stage: compute vitals, trends, dedupe, organize. Fast, reliable, offline. |
| **REM** | LLM pass | The model-driven stage: read transcripts, find patterns, draft findings/experiments/config recs. |
| **Reflection** | morning review | The user ritual of reviewing a report: accept/reject findings, enable experiments. |
| **Vitals** | metrics | The computed metrics for a window (tokens, cost, re-ask rate, etc.). See `13`. |
| **Ring** | composite score | One of three headline 0–100 composite scores: Efficiency, Effectiveness, Alignment. Baseline-normalized. |
| **Baseline** | your recent normal | Trailing-window (default 14-day) reference value for a metric, per scope. |
| **Delta** | change vs baseline | Current value vs baseline, with a significance hint. |
| **Digest** | the TL;DR | The 2–3 sentence plain-language summary of a report. |
| **Finding** | an insight | A grounded REM insight: Win, Mistake, Risk, or Opportunity, with evidence + confidence + a proposed action. |
| **Evidence** | the receipts | The specific sessions/events/diffs a finding/claim is based on. Mandatory. |
| **Proposed action** | suggested fix | The single recommended next step on a finding (config change, memory note, experiment, or nudge). |
| **Protection** | mistake guard | A proposed change that prevents a detected mistake from recurring. |
| **Experiment** | a tracked test | A hypothesis-driven, measurable change (e.g. "medium effort for UI") that the next dream grades. |
| **Intervention** | the change itself | What an experiment actually alters in behavior/config. |
| **Enablement** | how it's applied | The mechanism that makes an intervention take effect: instruction-injection, manual-nudge, setting, hook. |
| **Treated / Control** | test arms | Sessions where an experiment's intervention was in scope (treated) vs not (control). |
| **Grading** | scoring an experiment | The next dream's measured verdict on a running experiment: Improved / Inconclusive / Regressed. |
| **Adopt / Revert** | conclude an experiment | Make the change permanent (adopt) or cleanly undo it (revert). |
| **Lab** | experiments panel | The UI surface listing active/concluded experiments and their results. |
| **Connector** | data adapter | A read-only adapter that discovers and parses one harness's on-disk data. |
| **Ingestion** | data intake | The pipeline turning raw harness files into normalized `Event`/`Session` rows. |
| **Event** | one occurrence | The normalized atomic record (prompt, model call, tool call, edit, error…). The metrics workhorse. |
| **Session** | one transcript | One agent session = one transcript file, made of Events. |
| **Project** | one codebase | A working directory/repo the harness operated in (from transcript `cwd`). |
| **Dream Engine** | the analyzer | The component running Deep Sleep + REM + assembly. See `15`. |
| **Redaction** | secret scrubbing | The layer that scrubs secrets/PII from any excerpt before a cloud LLM call. |
| **Local-only mode** | no-cloud mode | A configuration where no data leaves the device; REM is local-model or disabled. |
| **Task archetype** | task category | UI / refactor / debug / feature / docs classification used for fair comparisons. |
| **Re-ask** | repeat request | When the user prompts again for the same goal — a key effectiveness signal. |
| **Correction / Revert** | undoing the agent | User redirecting the agent (correction) or undoing an accepted edit (revert) — alignment signals. |

## Usage notes

- Prefer the **plain meaning** in user-facing copy when clarity is at stake; the
  metaphor terms are flavor, not a barrier (`02`).
- "Dream" = the run; "Dream Report" = the artifact; "Reflection" = the human
  review. Keep these three distinct.
- "Vitals" = metrics in general; "Ring" = the three composite scores
  specifically.
