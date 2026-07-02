# Harness Health — Product Documentation

> **Harness Health — Your Harness Health App.**
> What does your coding harness do when it goes to idle? Right now, nothing.
> Harness Health goes to work while your harness rests — reviewing the day,
> replaying scenarios, consolidating wins and mistakes, and waking you up with a
> health report and a set of suggested improvements to make tomorrow better.

This folder is the canonical design spec for the product. It is a set of living
documents meant to be read, argued with, and built from.

## What this product is, in one paragraph

Harness Health is a **macOS menu-bar app** that acts as a *health and reflection
layer* for AI coding harnesses (Claude Code today; Codex, Cursor, and others
later). While you idle, it ingests the day's agent sessions, computes
**vitals** (token efficiency, code delivered, re-ask rate, model mix, cost…),
finds **patterns across your projects**, and produces a **Health Report** styled
like the Apple Health app. Each morning you run a **Reflection** ritual: review
findings, accept or reject them, and track **suggested improvements** ("try
medium thinking effort for UI work") that the *next* review measures and reflects
on. Over time your harness adapts, learns, and evolves with you.

## How to read these docs

| Read order | If you are… | Start with |
|---|---|---|
| Skim the why | a stakeholder / curious | `01`, `02`, then `23` (roadmap) |
| Build the MVP | an engineer | `04`, `17`, `21`, `12`, `14`, then `23` |
| Design the UX | a designer | `02`, `03`, `06`, `18`, `19` |
| Own a feature | a PM | `04` + the relevant `05`–`11` feature doc |

## Document map

### Foundations — *why and what*
| File | Title | Contents |
|---|---|---|
| [01-vision-and-strategy.md](01-vision-and-strategy.md) | Vision & Strategy | Problem, insight, vision, value prop, positioning, why-now |
| [02-concept-deep-dive.md](02-concept-deep-dive.md) | Concept Deep Dive | The idle/review mental model, the learning flywheel, the daily loop |
| [03-personas-and-jobs.md](03-personas-and-jobs.md) | Personas & Jobs | Who it's for, jobs-to-be-done, user stories, a day in the life |
| [04-product-scope.md](04-product-scope.md) | Product Scope | In/out of scope, MVP boundary, product principles, non-goals |

### Features — *the experience*
| File | Title | Contents |
|---|---|---|
| [05-feature-review-sessions.md](05-feature-review-sessions.md) | Health Reviews | The core loop: idle → review → report |
| [06-feature-metrics-and-health.md](06-feature-metrics-and-health.md) | Metrics & Health | Vitals, rings, trends, the Health-app surface |
| [07-feature-findings-and-actions.md](07-feature-findings-and-actions.md) | Findings & Actions | Findings, accept/reject, mistake protection |
| [08-feature-experiments.md](08-feature-experiments.md) | Suggested Improvements | Testable improvements and their measurement lifecycle |
| [09-feature-config-and-memory.md](09-feature-config-and-memory.md) | Config & Memory | Tuning AGENTS.md, skills, MCP, and memory |
| [10-feature-chat-assistant.md](10-feature-chat-assistant.md) | Chat Assistant | Conversational optimization interface |
| [11-feature-comparative-insights.md](11-feature-comparative-insights.md) | Comparative Insights | Cross-harness, cross-model, cross-project patterns |

### Engineering — *how it's built*
| File | Title | Contents |
|---|---|---|
| [12-data-model.md](12-data-model.md) | Data Model | Entities, relationships, lifecycle, storage |
| [13-metrics-catalog.md](13-metrics-catalog.md) | Metrics Catalog | Every metric: definition, formula, source |
| [14-ingestion-and-connectors.md](14-ingestion-and-connectors.md) | Ingestion & Connectors | Data sources, parsing, normalization |
| [15-review-engine.md](15-review-engine.md) | Health Review Engine | The analysis pipeline and LLM orchestration |
| [16-experiments-engine.md](16-experiments-engine.md) | Improvements Engine | Enablement mechanisms, measurement, statistics |
| [17-architecture.md](17-architecture.md) | Architecture | System components, data flow, the daemon |
| [18-macos-app.md](18-macos-app.md) | macOS App | Menu-bar shell, windows, packaging, notifications |
| [19-ui-ux-design.md](19-ui-ux-design.md) | UI/UX & Design | Design language, screens, components, motion |

### Delivery — *plan, risk, decisions*
| File | Title | Contents |
|---|---|---|
| [20-privacy-and-security.md](20-privacy-and-security.md) | Privacy & Security | Local-first, redaction, secrets, threat model |
| [21-monorepo-and-packages.md](21-monorepo-and-packages.md) | Monorepo & Packages | Concrete package layout in this repo |
| [22-tech-decisions-adr.md](22-tech-decisions-adr.md) | Tech Decisions (ADR) | The big calls and their rationale |
| [23-roadmap-and-milestones.md](23-roadmap-and-milestones.md) | Roadmap & Milestones | Phases, MVP cut, sequencing, definition of done |
| [24-risks-and-open-questions.md](24-risks-and-open-questions.md) | Risks & Open Questions | Unknowns, validation bets, decisions needed |
| [25-glossary.md](25-glossary.md) | Glossary | Terminology, used consistently across all docs |

## Status legend

These docs use a consistent status marker at the top of each file:

- 🟢 **Locked** — decided; change only with a documented reason.
- 🟡 **Draft** — directionally agreed; details open.
- 🔴 **Exploratory** — a proposal to react to, not a commitment.

## Naming note

Throughout, **"harness"** means an agentic coding tool (Claude Code, Codex CLI,
Cursor, etc.). **"Review"** is the overnight analysis run. The idle metaphor is
used deliberately but never at the expense of clarity — see
[02-concept-deep-dive.md](02-concept-deep-dive.md).
