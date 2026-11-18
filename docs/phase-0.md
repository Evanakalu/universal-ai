# Phase 0: Foundations (weeks 1 to 4)

Started 18 Nov 2026 on the product owner's instruction. Phase 1 scope approved the same day: documents, research, spreadsheets, websites and interactive web apps, and file analysis.

**Decided by the product owner (18 Nov 2026):** the legal opinion on Proclamation No. 1321/2024 is no longer a condition for this project. The product is being run internationally and no Ethiopia-specific rules apply to it. Language reviewer sign-off (tasks 5 and 7) is still required; it is linguistic quality control, not a legal requirement.

## Workstreams

| # | Task | Owner | Week | Evidence for Gate 0 | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | Repository, strict TypeScript, test runner, CI | Claude | 1 | CI green on main | Done (CI file ready; needs GitHub repo) |
| 2 | Capability SDK and the five Phase 1 manifests | Claude | 1 | Contract tests pass | Done |
| 3 | Model Capability Registry, router, metering, budget guard | Claude | 1 | Router tests pass | Done |
| 4 | i18n helpers: search normalisation, calendar, script detection | Claude | 1 | 1990 to 2050 calendar check vs ICU passes | Done |
| 5 | Reviewer sign-off on Ethiopic folding rules (Amharic and Tigrinya) | Reviewers | 1 to 2 | Signed note in `docs/` | Waiting for reviewers |
| 6 | EthioEval tooling: schema, scoring, pass bars, kappa | Claude | 1 | Tests pass | Done |
| 7 | Recruit two reviewers per language (Oromo reviewers still to be found) | Product owner | 1 to 2 | Names and contracts | Open |
| 8 | Write EthioEval items: at least 60 per task type per language (about 1,600) | Reviewers | 2 to 3 | Items pass validator | Open |
| 9 | Provider accounts on paid tiers: Anthropic, Google; OpenAI optional | Product owner | 1 | Keys in a secrets store, never in the repo | Open |
| 10 | Provider adapters (Anthropic, Google) behind the gateway interface | Claude + developer | 2 | Contract tests against live APIs | Needs network access and keys |
| 11 | Run EthioEval on candidate models; reviewers score samples | Claude + reviewers | 3 to 4 | Score table per model, language and task | Open |
| 12 | Measure tokens per 1,000 words per language and model; re-run cost model | Claude | 3 | Updated `tools/cost_model.py` inputs | Needs API access |
| 13 | Measure latency from Addis Ababa to candidate hosting regions | Developer or tester in Ethiopia | 3 | Latency table | Open |
| 14 | Confirm provider data terms (retention, storage country) from data processing addenda | Product owner + Claude | 2 | `dataTerms` updated with sources | Open |
| 15 | Chapa merchant application | Product owner | 1 | Application submitted | Open |
| 16 | Choose name, domain and team model | Product owner | 1 | Decisions recorded | Open |

## What blocks progress from this workspace

- Package installs and outbound API calls are disabled in the current chat, so tasks 10 to 12 cannot run here. Either enable network access for package installs, or connect a project folder on a machine that has it.
- The code needs a home: create a GitHub repository (private) and grant access, or connect a folder through the Claude desktop app.
