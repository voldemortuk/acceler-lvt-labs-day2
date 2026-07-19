# tasks-api-example-output — full worked example from a live Spec Kit run

This folder is the **complete output** of running the seven-command Spec Kit pipeline end-to-end against the demo prompts in the [demo README](../README.md). It is committed as a **worked example** so learners doing the demo can compare their intermediate and final artifacts against a known-good baseline.

Verified: 2026-07-01 · Spec Kit v0.12.3.dev0 · 75/75 Vitest tests green · TypeScript strict, no warnings.

## What's in here

| Path | What it is |
|---|---|
| `.specify/memory/constitution.md` | Output of `/speckit-constitution` — the 5-principle project constitution |
| `specs/001-tasks-api/spec.md` | Output of `/speckit-specify` + `/speckit-clarify` — the executable specification with prioritized user stories, functional requirements, success criteria, and clarifications |
| `specs/001-tasks-api/plan.md` | Output of `/speckit-plan` — the implementation plan with constitution-check gate |
| `specs/001-tasks-api/research.md` | Auto-generated Phase 0 research decisions (7 decisions with rationale and rejected alternatives) |
| `specs/001-tasks-api/data-model.md` | Auto-generated Phase 1 data model (entities, invariants, state transitions, validation rules) |
| `specs/001-tasks-api/contracts/openapi.yaml` | Auto-generated OpenAPI 3.1 contract for the 4 endpoints |
| `specs/001-tasks-api/quickstart.md` | Auto-generated smoke-test / manual-QA guide |
| `specs/001-tasks-api/checklists/requirements.md` | Requirements coverage checklist |
| `specs/001-tasks-api/tasks.md` | Output of `/speckit-tasks` + `/speckit-analyze` remediations — 35 tasks across 7 phases, with parallel markers and story tags |
| `src/**/*.ts` | Output of `/speckit-implement` — 11 production TypeScript files + 11 test files |
| `package.json`, `tsconfig.json`, `vitest.config.ts` | Build/test tooling generated during implement |
| `README.md` | Repo-level README that Spec Kit generated for the new project |

## What is NOT in here (deliberately)

- **`.claude/`** or **`.github/`** integration folders — the run happened via the Copilot integration for auth reasons, but the artifacts (`.specify/`, `specs/`, `src/`) are identical regardless of which integration produced them. The integration only affects *how* you invoke the slash commands, not *what* they produce.
- **`node_modules/`** — regenerate with `npm install`.
- **`data/`** — created at runtime by the atomic-write store.

## How to run this yourself

```powershell
cd tasks-api-example-output
npm install
npm test              # expect 75 passing
```

To verify the manual smoke pass, follow [specs/001-tasks-api/quickstart.md](specs/001-tasks-api/quickstart.md).

## Do NOT re-run Spec Kit skills against this folder

Running `/speckit-specify`, `/speckit-plan`, etc. against this folder will mutate the reference artifacts and destroy its value. If you want to try the pipeline, do it in a scratch directory outside the repo (see the [demo README](../README.md) for the walkthrough).

## Provenance

All prompts and expected outputs are in the [demo README](../README.md). Summary of what produced this folder:

- **Constitution prompt** — the five-principle block from the *Phase 0 — Constitution* section of the demo.
- **Specify prompt** — the Tasks API description from the *Phase 1 — Specify* section.
- **Clarify** — 5 questions asked (list ordering, task ID format, observability, corrupted-store recovery, timezone). All answered with the recommended defaults.
- **Plan prompt** — the Node.js/TypeScript/Express/Zod stack description from the *Phase 2 — Plan* section.
- **Tasks** — 35 tasks across 7 phases (after remediation).
- **Analyze remediations applied**: G1 (perf test), G2 (automated restart cycle), G3 (log happy-path assertion), G4 (startup timezone assertion), U1 (schemaVersion invariant), A1 (SC-003 tightening).
