# Universal AI

A task-oriented AI platform for Amharic, Tigrinya and Afaan Oromo speakers: users describe an outcome and get finished work (documents, spreadsheets, research, websites and interactive web apps) that they can preview, edit, download and publish.

The architecture is set out in the **Master Technical Blueprint** (Draft 0.2). This repository is at **Phase 0** (foundations); see [`docs/phase-0.md`](docs/phase-0.md).

## What is here today

| Path | What it does | Status |
| --- | --- | --- |
| `packages/core-types` | Shared lists: languages, model operations, EthioEval task types, data classes, cost categories | Done |
| `packages/capability-sdk` | Universal Capability Registry: manifest schema and validation, versions, per-plan enablement, rollback by pinning, permission decisions | Done, tested |
| `capabilities/*` | Manifests for the five Phase 1 capabilities: `document.create`, `sheet.create`, `research.web`, `file.ask`, `webapp.build` | Manifests only; handlers come in Phase 1 |
| `packages/ai-gateway` | Model Capability Registry and router (operations, EthioEval gating, data classes, dated prices), metering, budget guard, seed model entries | Done, tested; no provider adapters yet |
| `packages/i18n` | Ethiopic and Oromo search normalisation, script detection, Ethiopian calendar, locales, reply-language rule | Done, tested; folding rules need reviewer sign-off |
| `evals/` | EthioEval item schema, pass bars, scoring, Cohen's kappa, automatic constraint checks, item template | Done, tested; no test items yet (native speakers write them) |
| `tools/cost_model.py` | Cost scenarios used in blueprint section 13 | Done |
| `apps/` | Web app, API and worker | Not started (Phase 1; needs package installs) |

## Running the checks

Requires Node.js 22.6 or later and pnpm.

```bash
pnpm install        # TypeScript and Node type definitions only
pnpm typecheck      # strict TypeScript, no emit
pnpm test           # node:test with built-in TypeScript type stripping
python3 tools/cost_model.py
```

The packages have no runtime dependencies yet, so `pnpm test` also works without installing anything.

## Rules for contributors

- No text shown to users in code: every string goes in translation files reviewed by native speakers.
- Every provider call goes through `ai-gateway`; nothing calls a provider directly.
- Every new kind of work is a capability package with a manifest; the orchestrator never contains capability-specific code.
- Customer content never goes to a model that the router rejects for that data class. Free tiers are for synthetic test data only.
- EthioEval items are written by native speakers. AI-written or machine-translated items are rejected by the validator.
