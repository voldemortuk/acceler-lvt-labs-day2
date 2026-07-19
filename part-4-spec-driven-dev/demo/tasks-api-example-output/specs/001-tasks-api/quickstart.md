# Quickstart: Tasks API

**Feature**: 001-tasks-api
**Purpose**: Runnable validation scenarios that prove the feature works
end-to-end. Not an implementation guide — for source layout see
[plan.md § Source Code](./plan.md#source-code-repository-root); for the
domain model see [data-model.md](./data-model.md); for the wire format see
[contracts/openapi.yaml](./contracts/openapi.yaml).

## Prerequisites

- Node.js 20 LTS installed (`node --version` prints `v20.x`).
- Repo cloned; working directory is the repo root.
- Empty `./data/` directory (or set `STORE_PATH` to point elsewhere).

## Setup

```pwsh
npm install
```

## Run the test suite (Phase 1 validation)

Every user story and functional requirement is covered by a colocated
Vitest test. The suite MUST be green before the feature is considered
complete.

```pwsh
npm test
```

Expected: all tests pass, including:

- **Contract tests** for `POST /tasks`, `GET /tasks`, `POST /tasks/{id}/complete`,
  `DELETE /tasks/{id}` (shape and status codes match
  [contracts/openapi.yaml](./contracts/openapi.yaml)).
- **Atomic-write test** (`src/lib/atomic-write.test.ts`): asserts the target
  file is either fully written or unchanged after a simulated crash between
  every syscall.
- **Service tests** (`src/services/task-service.test.ts`): list ordering per
  FR-004a, overdue derivation per FR-009, idempotent complete per FR-006,
  not-found on unknown id per FR-008.
- **Repository tests**: startup on missing store, startup on valid store,
  startup on corrupt store (asserts file is renamed to
  `<path>.corrupt.<timestamp>` and process exits non-zero).

## Run the service manually

```pwsh
npm run dev
```

Default port `3000`, default store path `./data/tasks.json`. Override with
`PORT=4000 STORE_PATH=./tmp/tasks.json npm run dev`.

On start, one JSON log line is emitted to stdout including the effective
timezone name (see FR-018 and research Decision 5).

## End-to-end smoke test (per user story)

### User Story 1 — Capture and list (P1)

```pwsh
# create with due date
curl -sX POST http://localhost:3000/tasks `
  -H "Content-Type: application/json" `
  -d '{"title":"File taxes","dueDate":"2026-04-15"}'

# create without due date
curl -sX POST http://localhost:3000/tasks `
  -H "Content-Type: application/json" `
  -d '{"title":"Buy milk"}'

# list
curl -s http://localhost:3000/tasks
```

**Expected**: The list response contains both tasks with server-assigned UUID
v4 ids, `status: "open"`, and `overdue: true` for the past-due one (assuming
today > 2026-04-15).

### User Story 2 — Crash safety (P1)

The scripted version lives in the test suite (`atomic-write.test.ts` and
`task-repository.test.ts`). Manual reproduction:

```pwsh
# 1. Start the service, create 3 tasks, then Ctrl+C.
# 2. Stop-Process -Force the node process during a POST if you want a rough
#    approximation, or use the crash test in the suite for a deterministic one.
# 3. Restart:
npm run dev
# 4. GET /tasks — every task acknowledged before the kill is still present;
#    no partially written record appears; startup log line reports the loaded
#    count.
```

**Expected**: Zero tasks lost across restarts; no `SyntaxError` at load.

### User Story 3 — Complete and delete (P2)

```pwsh
$id = (curl -sX POST http://localhost:3000/tasks `
  -H "Content-Type: application/json" -d '{"title":"Ship it"}' `
  | ConvertFrom-Json).id

# mark complete
curl -sX POST "http://localhost:3000/tasks/$id/complete"

# mark complete again (idempotent, FR-006)
curl -sX POST "http://localhost:3000/tasks/$id/complete"

# delete
curl -sX DELETE "http://localhost:3000/tasks/$id"

# not-found on second delete
curl -si -X DELETE "http://localhost:3000/tasks/$id"
```

**Expected**: First complete returns 200 with `status: "complete"`. Second
complete also returns 200 with the same body. First delete returns 204.
Second delete returns 404 with `error: "not_found"`.

### User Story 4 — Overdue at a glance (P2)

```pwsh
# create one past-due, one future-due, one no-due
curl -sX POST http://localhost:3000/tasks -H "Content-Type: application/json" -d '{"title":"Old","dueDate":"2020-01-01"}'
curl -sX POST http://localhost:3000/tasks -H "Content-Type: application/json" -d '{"title":"Future","dueDate":"2099-12-31"}'
curl -sX POST http://localhost:3000/tasks -H "Content-Type: application/json" -d '{"title":"Someday"}'

curl -s http://localhost:3000/tasks | ConvertFrom-Json | Select-Object -Expand tasks | Format-Table title,status,dueDate,overdue
```

**Expected**: `Old` is first with `overdue: true`; then `Future` (open, not
overdue); then `Someday` (open, no due date). Order matches FR-004a.

## Cleanup

```pwsh
Remove-Item -Recurse -Force ./data
```

## Traceability

Every user story and success criterion in [spec.md](./spec.md) maps to at
least one scenario above and one automated test in the source tree. See the
test names in `src/**/*.test.ts` — each begins with the FR or SC identifier
it covers.
