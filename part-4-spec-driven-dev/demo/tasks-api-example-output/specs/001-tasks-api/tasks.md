---
description: "Task list for Tasks API (001-tasks-api)"
---

# Tasks: Tasks API (Single-User, No Auth)

**Input**: Design documents in [specs/001-tasks-api/](./)

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/openapi.yaml](./contracts/openapi.yaml)

**Tests**: REQUIRED for every task that adds or changes behavior. This is not optional — [constitution.md](../../.specify/memory/constitution.md) Principle I ("Tests Before Implementation") is NON-NEGOTIABLE. Every implementation task below is preceded by a test task, and the test MUST fail before the implementation task begins.

## Format: `- [ ] [ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel with other [P] tasks in the same phase (different files, no ordering dependency).
- **[Story]**: `[US1]`..`[US4]` — maps to the four user stories in [spec.md](./spec.md). Setup, Foundational, and Polish phases have no story label.
- Every task lists the exact file path(s) it touches.

## Path Conventions

Single-project TypeScript service. All source under `src/` at the repo root; tests colocated (`foo.test.ts` next to `foo.ts`). See [plan.md § Source Code](./plan.md#source-code-repository-root).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Get the TypeScript + Vitest + Express toolchain in place. No behavior yet.

- [X] T001 Create `package.json` at repo root with dependencies (`express@^4`, `zod@^3`) and devDependencies (`typescript@^5`, `vitest@^1`, `@types/node`, `@types/express`, `@types/supertest`, `supertest`, `tsx`), and scripts: `dev` (`tsx watch src/index.ts`), `build` (`tsc`), `test` (`vitest run`), `test:watch` (`vitest`).
- [X] T002 [P] Create `tsconfig.json` at repo root with the exact compiler options from [research.md § Decision 4](./research.md) (`strict`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `module: NodeNext`, `target: ES2022`, `outDir: dist`, `include: ["src/**/*.ts"]`).
- [X] T003 [P] Create `vitest.config.ts` at repo root configuring Vitest to discover colocated `*.test.ts` files under `src/`, node environment, and to fail on unhandled promise rejections.
- [X] T004 [P] Create `src/index.ts` and `src/app.ts` as empty placeholder modules (single `export {}` each) so `tsc --noEmit` and `vitest run` succeed against an empty project. This lets subsequent test-first tasks fail for the *right* reason (missing behavior), not missing files.

**Checkpoint**: `npm install && npm test` succeeds with zero tests; `npx tsc --noEmit` succeeds with zero errors.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Cross-cutting infrastructure every user story depends on: typed error hierarchy, structured logger, config parsing, and the Express app skeleton with the error-mapper middleware. **No user story work may begin until this phase completes.**

- [X] T005 [P] Create `src/errors.ts` defining `AppError` base class and typed subclasses `ValidationError` (with optional `details: {path,message}[]`), `NotFoundError`, `StoreCorruptError`, and `StoreWriteError`, each extending the previous via `class X extends AppError`. Include the `name` property set correctly on each subclass. (Constitution III.)
- [X] T006 [P] Create `src/errors.test.ts` asserting that each subclass is `instanceof AppError`, that `name` matches the class name, and that `ValidationError.details` round-trips. Test MUST be written before T005 is considered done — verify it fails against a stub, then implement.
- [X] T007 [P] Create `src/logger.test.ts` asserting: (a) `log(event, fields)` writes exactly one JSON line to stdout, (b) the line contains `timestamp`, `event`, and every field passed in, (c) unknown fields are preserved, (d) the timestamp is ISO 8601 UTC. Test-first — must fail before T008.
- [X] T008 [P] Create `src/logger.ts` implementing the `log(event: string, fields: Record<string, unknown>): void` function per FR-016..FR-018. Writes to `process.stdout` via `console.log(JSON.stringify(...))`. No dependencies beyond Node built-ins.
- [X] T009 [P] Create `src/config.test.ts` asserting: default `PORT=3000`, default `STORE_PATH=./data/tasks.json`, both overridable via env vars, invalid `PORT` throws `ValidationError`. Test-first.
- [X] T010 [P] Create `src/config.ts` exporting `loadConfig(env: NodeJS.ProcessEnv = process.env): { port: number; storePath: string }`. Uses Zod for parsing. Throws `ValidationError` on bad input. No side effects (no `console.log`, no file access).
- [X] T011 Create `src/middleware/error-mapper.test.ts` using supertest against a throwaway Express app that throws each `AppError` subclass in a route, asserting the status codes and body shapes from [research.md § Decision 2](./research.md). Test-first — must fail before T012.
- [X] T012 Create `src/middleware/error-mapper.ts` exporting an Express error-handling middleware that branches on `instanceof` and returns the JSON body shape from [contracts/openapi.yaml](./contracts/openapi.yaml). Logs unexpected errors (non-`AppError`) via `logger.log("request.error", …)` with full stack. Depends on T005, T008.
- [X] T013 Create `src/app.ts` (replace the placeholder from T004) exporting `createApp(deps): Express`. Wires JSON body parser, a request-log middleware that emits `request.ok`/`request.error`, the (still-empty) task router mount point at `/tasks`, then the error-mapper. Accepts a `taskService` dependency so tests can inject fakes. Depends on T012.

**Checkpoint**: All foundational tests green. `createApp({ taskService: {…stub…} })` returns a working Express instance that handles no routes yet but correctly maps errors.

---

## Phase 3: User Story 2 — Never lose data across crashes (Priority: P1)

**Goal**: A single atomic-write primitive and a `task-repository` that uses it. After this phase, the persistence layer is provably crash-safe even before any HTTP route exists.

**Independent Test**: Run `src/lib/atomic-write.test.ts` and `src/repositories/task-repository.test.ts` — the suite includes a simulated-crash test that asserts, over ≥50 iterations, the target file is always either the pre-write bytes or the post-write bytes, never partial or unreadable (spec SC-002). Additionally, quarantine-on-corruption is asserted.

**Why P1 first**: US2 provides the storage primitive US1, US3, and US4 all depend on. Building US1 first would either mean writing throwaway persistence or deferring the crash-safety guarantee — both violate constitution V.

### Tests for User Story 2 (write first, must FAIL)

- [X] T014 [P] [US2] Create `src/lib/atomic-write.test.ts` asserting: (a) writing new content produces a file equal to the input; (b) a crash simulated by throwing between `writeFile(temp)` and `rename` leaves the target unchanged AND leaves no leftover `*.tmp.*` in the directory that could ever be picked up as real data (assert cleanup on failure); (c) the temp file name includes pid + random suffix; (d) `fsync` and directory `fsync` are both invoked (spy on `fs.fsync`); (e) 50 iterations of "start write, kill at random syscall boundary, re-read" produce either pre-state or post-state, never a JSON parse error. (Spec FR-011, SC-002.)
- [X] T015 [P] [US2] Create `src/repositories/task-repository.test.ts` asserting: (a) `load()` on a missing file returns `{ schemaVersion: 1, tasks: [] }` and logs `store.initialized existed:false`; (b) `load()` on a valid file returns the parsed contents and logs `store.loaded existed:true count:N`; (c) `load()` on a corrupt file throws `StoreCorruptError`, renames the file to `<path>.corrupt.<ISO-timestamp>`, and logs `store.quarantined` (spec FR-013) — AND a file with valid JSON but `schemaVersion ≠ 1` also throws `StoreCorruptError` and is quarantined the same way (data-model invariant 6); (d) `saveAll(tasks)` writes via the atomic-write helper (spy it) and logs `store.write outcome:success`; (e) `saveAll` on write failure logs `store.write outcome:error` and throws `StoreWriteError`; (f) two concurrent `saveAll` calls serialize (assert second `writeFile` starts only after the first `rename` completes).

### Implementation for User Story 2

- [X] T016 [US2] Create `src/lib/atomic-write.ts` exporting `atomicWriteFile(targetPath: string, bytes: Buffer | string): Promise<void>` implementing temp→`fsync`→`rename`→dir `fsync` per [research.md § Decision 1](./research.md). Uses `node:fs/promises` and `node:crypto.randomBytes`. Cleans up temp file on any failure. No dependencies beyond Node built-ins. Depends on T014 (test must fail first).
- [X] T017 [US2] Create `src/repositories/task-repository.ts` exporting `createTaskRepository({ storePath, logger }): { load(): Promise<TaskStore>; saveAll(tasks: Task[]): Promise<void> }`. Uses `atomicWriteFile` for every write. Serializes writes via a single in-memory promise chain per [research.md § Decision 6](./research.md). Throws `StoreCorruptError` on parse failure and performs the quarantine rename before re-throwing. MUST NOT import anything from Express or any HTTP module. Depends on T015 (test first), T005, T008, T016.

**Checkpoint**: The service can persist and reload tasks safely across crashes with no HTTP layer present. Run `npx vitest run src/lib src/repositories` — all green.

---

## Phase 4: User Story 1 — Capture and list (Priority: P1) 🎯 MVP

**Goal**: HTTP endpoints for `POST /tasks` and `GET /tasks`. After this phase the MVP is demoable end-to-end: a user can create tasks and list them, and the tasks survive a restart (thanks to US2).

**Independent Test**: Run `src/routes/task-routes.test.ts` (create + list scenarios). Additionally, follow the User Story 1 curl scenario in [quickstart.md](./quickstart.md) — verify a created task appears in `GET /tasks` with a UUID v4 id, the correct fields, and `status: "open"`.

**Dependencies**: Requires Phase 2 (Foundational) and Phase 3 (US2) complete.

### Tests for User Story 1 (write first, must FAIL)

- [X] T018 [P] [US1] Create `src/services/task-service.test.ts` with the US1 slice of cases: `create({title})` returns a `Task` with a UUID v4 id, `status: "open"`, `createdAt` set, `completedAt: null`, `dueDate: null`; `create({title, dueDate})` stores the due date; `create({title: "   "})` throws `ValidationError`; `list()` returns every created task (ordering assertions deferred to US4's test file). Uses an in-memory fake repository. Test-first.
- [X] T019 [P] [US1] Create `src/routes/task-routes.test.ts` (US1 slice) using supertest against `createApp` with a real `task-service` backed by an in-memory fake repository: `POST /tasks` with valid body → 201 + `TaskView`; `POST /tasks` with empty title → 400 + `error: "validation_error"`; `POST /tasks` with malformed JSON → 400; `GET /tasks` returns the created tasks matching the `TaskView` shape from [contracts/openapi.yaml](./contracts/openapi.yaml). Additionally, spy on the injected logger and assert that every 2xx response emits exactly one `request.ok` line with `operation` (e.g. `"createTask"`, `"listTasks"`) and `outcome:"success"` (spec FR-016 happy path). Test-first.

### Implementation for User Story 1

- [X] T020 [P] [US1] Create `src/services/task-service.ts` exporting `createTaskService({ repository, now }): TaskService` with `create(input): Promise<Task>` and `list(): Promise<Task[]>` (list returns insertion order for now — ordering upgraded in US4). Uses `crypto.randomUUID()`. `now` is an injected `() => Date` for test determinism. MUST NOT import anything from Express or `http`. Depends on T017, T018 (test first).
- [X] T021 [US1] Create `src/routes/task-routes.ts` exporting `createTaskRouter(taskService): Router`. Defines `POST /` and `GET /` handlers only for now. Parses request bodies with the Zod schemas from [data-model.md § Validation Rules](./data-model.md). Serializes `Task` to `TaskView` (adds `overdue: false` placeholder for now — real derivation lands in US4). MUST NOT contain domain logic beyond parse/serialize. Depends on T020, T019 (test first).
- [X] T022 [US1] Update `src/app.ts` to mount `createTaskRouter(taskService)` at `/tasks` (replacing the empty router placeholder from T013). Update `src/index.ts` to: load config (T010), construct repository (T017), construct service (T020), call `createApp`, listen on `config.port`, and emit `server.started` and `server.stopped` log lines per [research.md § Decision 5](./research.md) including the effective IANA timezone.
- [X] T022a [US1] Create `src/index.test.ts` (or extend `src/logger.test.ts`) asserting that the startup log line emitted by the bootstrap includes a non-empty `timezone` field whose value equals `Intl.DateTimeFormat().resolvedOptions().timeZone` (or a valid IANA/offset fallback when unavailable). Covers spec FR-018 and the Q5 clarification. Test-first — must fail before T022 is considered done.

**Checkpoint**: MVP complete. `npm run dev`, run the US1 curl scenario from [quickstart.md](./quickstart.md), see created tasks in `GET /tasks`, kill and restart the process, see them still there. Constitution I–V still hold: every code file was preceded by a failing test, `tsc --noEmit` clean, no HTTP types in service, atomic-write on every persist.

---

## Phase 5: User Story 3 — Complete and delete (Priority: P2)

**Goal**: Add `POST /tasks/:id/complete` and `DELETE /tasks/:id`, including idempotent complete and clear 404s.

**Independent Test**: Run `src/routes/task-routes.test.ts` (US3 slice). Follow the US3 curl scenario in [quickstart.md](./quickstart.md): complete a task twice (both succeed, second is a no-op), delete it (204), then delete again (404).

**Dependencies**: Requires Phase 4 (US1) complete. US3 tests reuse the same test file `src/routes/task-routes.test.ts` and `src/services/task-service.test.ts`, adding new `describe` blocks — no new files.

### Tests for User Story 3 (write first, must FAIL)

- [X] T023 [US3] Extend `src/services/task-service.test.ts` with: `complete(id)` on open task sets `status:"complete"` and `completedAt` to the injected now; `complete(id)` on already-complete task returns the same task and does NOT call `repository.saveAll` (idempotency assertion — spy); `complete(unknownId)` throws `NotFoundError`; `remove(id)` on existing task removes it from `list()`; `remove(unknownId)` throws `NotFoundError`. Test-first.
- [X] T024 [US3] Extend `src/routes/task-routes.test.ts` with: `POST /tasks/:id/complete` on existing → 200 + updated `TaskView`; on same id again → 200 (idempotent); on unknown id → 404 + `error:"not_found"`; on malformed uuid → 404 (uniform behavior per [data-model.md § Validation Rules](./data-model.md)); `DELETE /tasks/:id` on existing → 204 no body; on unknown → 404. Test-first.

### Implementation for User Story 3

- [X] T025 [US3] Extend `src/services/task-service.ts` with `complete(id): Promise<Task>` and `remove(id): Promise<void>`. `complete` short-circuits without persisting when the task is already complete (satisfies FR-006 no-op requirement and avoids an unnecessary atomic-write cycle). Depends on T023.
- [X] T026 [US3] Extend `src/routes/task-routes.ts` with the `POST /:id/complete` and `DELETE /:id` handlers. Uses the UUID pattern from [contracts/openapi.yaml](./contracts/openapi.yaml) for `:id` validation — non-matching ids fall through to the "unknown id" branch and throw `NotFoundError` (never `ValidationError`). Depends on T025, T024.

**Checkpoint**: US1 + US3 together cover the full CRUD surface. Run the US3 quickstart scenario — every assertion passes.

---

## Phase 6: User Story 4 — See overdue tasks at a glance (Priority: P2)

**Goal**: Upgrade `GET /tasks` to derive the `overdue` flag and return tasks in the exact order defined by FR-004a. Small, self-contained change touching only `task-service.ts` and its test.

**Independent Test**: Run `src/services/task-service.test.ts` (US4 slice) and follow the US4 curl scenario in [quickstart.md](./quickstart.md). Verify a past-due open task is first with `overdue: true`, then future-due open, then no-due-date open, then completed last.

**Dependencies**: Requires Phase 4 (US1) complete. Independent of US3 in principle, but the "completed tasks last" ordering rule is only observable once US3's `complete` exists — so schedule after US3.

### Tests for User Story 4 (write first, must FAIL)

- [X] T027 [P] [US4] Extend `src/services/task-service.test.ts` (US4 `describe` block) with: `list()` marks a task `overdue:true` iff open AND `dueDate < today` (inject `now` for determinism); a completed past-due task has `overdue:false` (FR-009); a no-due-date task has `overdue:false`; the returned array is ordered per FR-004a — overdue open first (due asc), then other open (due asc, no-due last), then completed last (`completedAt` desc); `today` is captured once per call (assert by injecting a `now` that advances between calls but is stable within one call). Test-first.
- [X] T028 [P] [US4] Extend `src/routes/task-routes.test.ts` (US4 `describe` block) with a supertest scenario that creates the past/future/no-due/completed mix from the quickstart and asserts the `GET /tasks` response order and every `overdue` flag matches the spec.

### Implementation for User Story 4

- [X] T029 [US4] Update `src/services/task-service.ts` `list()` to (a) capture `today` once from injected `now`, (b) derive `overdue` per task, (c) partition and sort per [research.md § Decision 7](./research.md) — overdue open (due asc), other open (due asc, no-due last), completed (completedAt desc). Update the returned type so `TaskView` includes the derived `overdue: boolean`. Update `src/routes/task-routes.ts` serializer to pass the real `overdue` through (remove the US1 placeholder). Depends on T027, T028.

**Checkpoint**: All four user stories independently green. Full quickstart runs end-to-end.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening across stories. All tasks in this phase depend on all prior phases.

- [X] T030 [P] Run `npx tsc --noEmit` and confirm zero errors, zero uses of `any` (grep `src -R --include='*.ts' -n 'any'` and confirm every hit is either in a comment, a Zod `z.any()` inside a test fixture, or accompanied by a justifying comment per constitution II).
- [X] T031 [P] Add a `README.md` at repo root with the four sections from [quickstart.md](./quickstart.md) — prerequisites, setup, test, run — plus a one-paragraph note that this is a single-user, no-auth service intended for local use only (mirrors spec assumption).
- [X] T032 [P] Create `src/repositories/restart-cycle.test.ts` performing 100 iterations of: create a random batch of tasks via the repository, close/dispose the repository, re-open against the same store path, and assert every previously acknowledged task is still present with identical fields. Automates SC-006 so a regression fails CI rather than a human eye.
- [X] T033 [P] Create `src/services/task-service.perf.test.ts`: seed the repository with 1,000 tasks, then run 100 iterations of each operation (create, list, complete, delete) and assert p95 latency < 100 ms per operation. Covers SC-004. Skip via `describe.skipIf(process.env.CI_SKIP_PERF)` if CI hardware is known slow, but the test itself must exist and be runnable locally.
- [X] T034 Manual pass: perform the full [quickstart.md](./quickstart.md) end-to-end on a fresh clone. Confirm SC-001 (first task visible in one round-trip) and SC-005 (unknown id always 404) by walking through each User Story scenario. (SC-002, SC-004, SC-006 are already asserted automatically by T014, T033, T032 respectively.)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: no dependencies.
- **Phase 2 (Foundational)**: depends on Phase 1. **Blocks all user story phases.**
- **Phase 3 (US2 — persistence)**: depends on Phase 2. Blocks US1, US3, US4 because they all use the repository.
- **Phase 4 (US1 — capture & list)**: depends on Phase 3.
- **Phase 5 (US3 — complete & delete)**: depends on Phase 4.
- **Phase 6 (US4 — overdue at a glance)**: depends on Phase 4 (and, in practice, on Phase 5 for the completed-tasks-last ordering rule to be observable end-to-end).
- **Phase 7 (Polish)**: depends on all user story phases the release includes.

### Within Each User Story

- Every implementation task lists the test task it depends on. Tests MUST be written and failing before their implementation task begins (constitution I).
- Order inside a story: **test → model/service → route/handler → wire-up in `app.ts`/`index.ts`**.

### Parallel Opportunities

- Phase 1: T002, T003, T004 can run in parallel with T001 finishing first (needs `package.json` for `npm install`).
- Phase 2: T005/T006, T007/T008, T009/T010 are three independent test+impl pairs — three developers can each own one pair. T011/T012/T013 form a chain (middleware needs errors + logger; app needs middleware).
- Phase 3: T014 and T015 test files are independent [P]; T016 and T017 form a chain (repository uses atomic-write).
- Phase 4: T018 and T019 test files are independent [P]; implementation is a chain (T020 → T021 → T022).
- Phase 5: T023 and T024 are the same files as US1's tests (extended), so treat as sequential edits to those files, not [P].
- Phase 6: T027 and T028 touch different files → [P]. T029 is a single implementation edit.
- Phase 7: T030 and T031 are independent [P]; T032 is the final manual pass.

### Parallel Team Example (2 developers, post-Phase-2)

```text
Dev A: T014 → T016         # atomic-write helper
Dev B: T015 → T017         # task-repository (waits on T016 before starting T017)
```

Then converge on Phase 4 together.

---

## Implementation Strategy

### MVP scope

**Phases 1 → 2 → 3 → 4.** That is: Setup, Foundational, US2 (persistence), US1 (create + list). At the end of Phase 4 the service demonstrably delivers both P1 stories from the spec ("capture and list" AND "never lose data across crashes"). Ship here if desired.

### Incremental delivery after MVP

- Add Phase 5 (US3 — complete & delete) → demo → deliver.
- Add Phase 6 (US4 — overdue-at-a-glance ordering) → demo → deliver.
- Phase 7 polish before any external release.

### Constitution reminders (apply to every task)

- **I** — Write the test, watch it fail for the intended reason, then implement. No exceptions.
- **II** — `tsc --noEmit` strict must pass; no unjustified `any`.
- **III** — Only throw typed subclasses of `AppError`. Callers branch on `instanceof`.
- **IV** — Route files own parse/serialize; services own domain; repositories own storage. No cross-layer imports in the wrong direction.
- **V** — Every persist path goes through `atomic-write.ts`. Ad-hoc `fs.writeFile` on the store is prohibited.

---

## Notes

- Task count: 35 tasks across 7 phases (T001–T034 plus T022a).
- Test-to-implementation pairing: every implementation task cites its preceding test task; the test task must fail before implementation begins.
- File conflict avoidance: `src/services/task-service.ts`, `src/services/task-service.test.ts`, `src/routes/task-routes.ts`, and `src/routes/task-routes.test.ts` are extended across US1, US3, and US4 — those extensions are sequenced across phases, never parallel.
- Commit after each task or after each test+implementation pair.
