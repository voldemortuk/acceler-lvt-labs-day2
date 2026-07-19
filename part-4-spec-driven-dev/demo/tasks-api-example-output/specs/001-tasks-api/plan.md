# Implementation Plan: Tasks API (Single-User, No Auth)

**Branch**: `001-tasks-api` | **Date**: 2026-07-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-tasks-api/spec.md`

## Summary

A single-process, single-user HTTP API for tracking tasks (create, list,
complete, delete) with an at-a-glance overdue indicator and crash-safe
persistence. Technical approach: Node.js 20 + TypeScript (strict) + Express
for HTTP + Zod for input validation. Tasks persist to one JSON file, written
atomically via temp-file + `fsync` + `rename`. Tests are colocated with
source using Vitest. No database, no ORM, no authentication middleware.

## Technical Context

**Language/Version**: TypeScript 5.x targeting ES2022, running on Node.js 20 LTS.

**Primary Dependencies**: Express 4.x (HTTP), Zod 3.x (input validation),
`node:crypto.randomUUID` (UUID v4 generation), `node:fs/promises` +
`node:fs.fsync` (atomic writes). Dev: Vitest, `@types/express`, `@types/node`,
`supertest` for HTTP integration tests, `tsx` for local runs.

**Storage**: A single JSON file at a configurable path (default
`./data/tasks.json`). No database, no ORM. All mutations go through one
atomic-write helper: write to `<path>.tmp.<pid>.<random>`, `fsync` the temp
file, `rename` over the target, then `fsync` the containing directory.

**Testing**: Vitest, colocated (`foo.ts` next to `foo.test.ts`). Contract
tests for each HTTP endpoint via `supertest`. Unit tests for services and
the atomic-write helper. Integration test simulates a crash mid-write.

**Target Platform**: Node.js 20 on Linux/macOS/Windows developer machines
(single-process local deployment per the spec's trust model).

**Project Type**: Single-project web service (no frontend).

**Performance Goals**: Per SC-004, every request completes in under 100 ms at
a store size of 1,000 tasks on a typical developer laptop.

**Constraints**:

- Every persisted write MUST be atomic (spec FR-011, constitution V).
- All source MUST compile under TypeScript `strict` mode with no unjustified
  `any` (constitution II).
- Route files MUST NOT contain business logic; service files MUST NOT import
  HTTP types; repository files MUST NOT contain business logic
  (constitution IV).
- All thrown errors MUST be typed `Error` subclasses of a common `AppError`
  base (constitution III).
- One test written first for every behavior (constitution I).

**Scale/Scope**: One user, one process, up to ~1,000 tasks in typical use.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Against [.specify/memory/constitution.md](../../.specify/memory/constitution.md) v1.0.0:

| # | Principle | Compliance | How this plan satisfies it |
|---|-----------|-----------|-----------------------------|
| I | Tests Before Implementation | PASS | Vitest colocated. `tasks.md` will order every implementation task after a failing-test task. Contract tests (supertest) and the crash-during-write test will be written first. |
| II | No Untyped Code | PASS | `tsconfig.json` sets `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`, `noUncheckedIndexedAccess: true`. Zod schemas produce typed values via `z.infer`; no `any` needed at the parse boundary. |
| III | Errors As Values | PASS | Shared `AppError` base with subclasses: `ValidationError`, `NotFoundError`, `StoreCorruptError`, `StoreWriteError`. A single error-mapping middleware translates `instanceof` branches to HTTP status codes. No string throws, no bare `new Error(...)`. |
| IV | One Responsibility Per File | PASS | Layers: `src/routes/*` (Express only), `src/services/*` (domain only, imports no Express types), `src/repositories/*` (fs/JSON only). Dependency direction routes → services → repositories, enforced by review. |
| V | Data Safety Over Convenience | PASS | Single `src/lib/atomic-write.ts` helper: write temp → `fsync` temp → `rename` → `fsync` dir. All repository writes go through it. Crash-during-write test asserts the store is always either pre-write or post-write, never partial. |

**Initial Gate Result**: PASS — no violations.

**Post-Design Re-Check** (after Phase 1): PASS — the data model, contracts,
and quickstart introduce no new constructs that violate the five principles.
The Complexity Tracking table below remains empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-tasks-api/
├── plan.md              # This file (/speckit.plan output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── openapi.yaml
├── checklists/
│   └── requirements.md  # From /speckit.specify
├── spec.md              # From /speckit.specify + /speckit.clarify
└── tasks.md             # /speckit.tasks output (not created here)
```

### Source Code (repository root)

```text
src/
├── index.ts                       # Process entry: config load, app wire-up, listen
├── app.ts                         # Express app assembly (no listen call, for testability)
├── config.ts                      # Env parsing (STORE_PATH, PORT); no side effects
├── errors.ts                      # AppError base + typed subclasses
├── logger.ts                      # Structured JSON stdout logger (one line per event)
├── lib/
│   ├── atomic-write.ts            # Sole persistence primitive (temp → fsync → rename)
│   └── atomic-write.test.ts
├── repositories/
│   ├── task-repository.ts         # load(), saveAll(); uses atomic-write; no HTTP, no domain rules
│   └── task-repository.test.ts
├── services/
│   ├── task-service.ts            # create/list/complete/delete + overdue + ordering; no HTTP types
│   └── task-service.test.ts
├── routes/
│   ├── task-routes.ts             # Express router: parse → service call → serialize
│   └── task-routes.test.ts        # supertest contract tests
└── middleware/
    ├── error-mapper.ts            # instanceof AppError → HTTP status; no domain logic
    └── error-mapper.test.ts

tsconfig.json
package.json
vitest.config.ts
```

**Structure Decision**: Single project, single-service layout. Files are
grouped by layer (`routes/`, `services/`, `repositories/`), which makes
constitution principle IV auditable at a glance: any cross-layer import in
the wrong direction is visible in a single grep. Tests are colocated
(`foo.test.ts` next to `foo.ts`) per the user's requirement and to make the
"failing test written first" workflow low-friction.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified.

_No violations. Table intentionally empty._

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
