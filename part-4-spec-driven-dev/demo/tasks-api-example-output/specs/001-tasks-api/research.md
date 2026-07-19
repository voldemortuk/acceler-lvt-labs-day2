# Phase 0 Research: Tasks API

**Feature**: 001-tasks-api
**Date**: 2026-07-01
**Status**: All unknowns resolved.

The user's `/speckit.plan` arguments and the answers captured in
[spec.md § Clarifications](./spec.md#clarifications) fully specify the stack.
No `NEEDS CLARIFICATION` markers remained after Phase 0 scan. This document
records the small number of technical choices that still needed a decision
(atomic-write mechanics, error-to-status mapping, JSON layout, TS config
flags) with rationale and rejected alternatives.

---

## Decision 1: Atomic write mechanics

**Decision**: `writeFile(temp, bytes)` → `fsync(temp)` → `rename(temp, target)`
→ `fsync(dirfd of target's directory)`. Temp file name pattern:
`<target>.tmp.<pid>.<crypto.randomBytes(8).hex>`.

**Rationale**:

1. `rename` is POSIX-atomic on the same filesystem, so a reader either sees
   the old inode or the new one — never a partial one.
2. `fsync` on the temp file forces bytes to disk before the rename, so the
   post-crash filesystem cannot contain a renamed-but-empty file.
3. `fsync` on the parent directory persists the rename itself; without it, a
   crash can leave the rename undone even though the temp file is durable.
4. The pid + random suffix prevents temp collisions if multiple processes
   ever touch the file (the spec assumes single-process, but this costs
   nothing and future-proofs).

**Alternatives considered**:

- **`fs.writeFile` in place**: Rejected — violates constitution V. A crash
  mid-write leaves the target truncated or half-written.
- **Append-only log + periodic snapshot**: Rejected — more crash-safe still,
  but adds a compaction lifecycle and a replay path the spec does not need at
  ~1,000-task scale.
- **SQLite**: Rejected — user explicitly excluded databases.
- **Skip parent-directory `fsync`**: Rejected — well-documented data-loss
  scenario on ext4/xfs after power loss.

## Decision 2: Error → HTTP status mapping

**Decision**: Single `error-mapper` middleware that branches on `instanceof`:

| Error class | HTTP status | Body shape |
|-------------|-------------|------------|
| `ValidationError` | 400 | `{ error: "validation_error", message, details? }` |
| `NotFoundError` | 404 | `{ error: "not_found", message }` |
| `StoreCorruptError` | 500 | `{ error: "internal_error", message: "store is corrupt" }` (also triggers process exit path on startup, see Decision 5) |
| `StoreWriteError` | 500 | `{ error: "internal_error", message: "write failed" }` |
| Any other `Error` | 500 | `{ error: "internal_error", message: "unexpected error" }` (logged with full stack) |

**Rationale**: Keeps constitution III intact (callers branch on `instanceof`,
never string-match), keeps the mapping in exactly one file (constitution IV),
and gives clients a stable, machine-readable `error` discriminator.

**Alternatives considered**:

- **`status` field on `AppError`**: Rejected — leaks HTTP concerns into the
  domain layer (violates constitution IV, since services would need to know
  status codes).
- **Throw HTTP-shaped exceptions from Express handlers**: Rejected — same
  leak, different direction.

## Decision 3: JSON store layout

**Decision**: The file is a single JSON object, not a bare array:

```json
{
  "schemaVersion": 1,
  "tasks": [
    {
      "id": "…uuid v4…",
      "title": "…",
      "dueDate": "2026-04-15" | null,
      "status": "open" | "complete",
      "createdAt": "2026-07-01T12:34:56.789Z",
      "completedAt": "2026-07-02T09:00:00.000Z" | null
    }
  ]
}
```

**Rationale**:

1. `schemaVersion` gives a cheap upgrade path if the shape ever changes,
   without a database migration story.
2. An object wrapper lets us add sibling metadata later (e.g., `lastWriteAt`)
   without breaking existing parsers.
3. Dates use ISO 8601 strings, which round-trip cleanly through
   `JSON.parse`/`stringify` without a custom reviver. `dueDate` is a
   `YYYY-MM-DD` calendar date (no time component, matches spec assumption).
4. `completedAt` is required for FR-004a's "completed tasks sorted by
   completion time descending".

**Alternatives considered**:

- **Bare array of tasks**: Rejected — no room for metadata, no version.
- **NDJSON (one task per line)**: Rejected — harder to atomically overwrite;
  incremental append would need a different persistence strategy.
- **Store `dueDate` as an epoch millis integer**: Rejected — obscures the
  calendar-date semantic and reintroduces a timezone question at read time.

## Decision 4: TypeScript compiler settings

**Decision**: `tsconfig.json` includes at minimum:

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"]
}
```

**Rationale**: Directly enforces constitution II. `noUncheckedIndexedAccess`
in particular catches a common source of `undefined`-that-looks-like-a-value
bugs when working with the tasks array.

**Alternatives considered**: A looser `strict: true` alone would pass the
letter of the constitution but leave `noUncheckedIndexedAccess` off, which is
the exact flag that would have caught real bugs in a list-heavy service.

## Decision 5: Startup sequence & corrupt-store handling

**Decision**: `index.ts` performs, in order:

1. Parse config (`STORE_PATH`, `PORT`) — throw `ValidationError` on bad input,
   exit code 2.
2. Attempt `taskRepository.load()`.
   - If the file does not exist → in-memory empty store, log `store.initialized`
     with `existed: false`.
   - If the file exists and parses → in-memory store, log `store.loaded` with
     `existed: true, count: N`.
   - If the file exists and fails to parse → `StoreCorruptError`. The startup
     handler catches it, renames the bad file to
     `<path>.corrupt.<ISO-8601-timestamp>`, logs `store.quarantined`, and
     exits with code 3. (Spec FR-013.)
3. Assemble Express app.
4. Emit `server.started` log line including `pid`, `port`, and effective IANA
   timezone (from `Intl.DateTimeFormat().resolvedOptions().timeZone`).
5. Install SIGTERM/SIGINT handler → `server.stopping` log → close server →
   `server.stopped` log.

**Rationale**: Puts every observability line required by FR-016..FR-019 in a
single, testable startup module. Timezone is captured at startup only (spec
Q5 answer), so a per-request overdue calculation just reads
`new Date()` locally.

**Alternatives considered**:

- **Health/metrics endpoint**: Rejected — spec FR-019 explicitly excludes it.
- **Retry the parse a few times before quarantining**: Rejected — masks
  transient FS issues and delays the operator's response.

## Decision 6: Concurrency serialization within the process

**Decision**: A single in-memory promise chain in `task-repository.ts`
serializes all `saveAll` calls: each mutation awaits the previous
`saveAll` promise before starting its own. Reads (`load`) do not serialize
against writes because the write is atomic at the FS layer.

**Rationale**: Satisfies FR-015 with no external dependency. Because Node's
event loop is single-threaded, no lock library is needed — a chained promise
is sufficient and observable in tests.

**Alternatives considered**:

- **`async-mutex` package**: Rejected — adds a dependency for a two-line
  primitive.
- **Rely on Node's single-threaded event loop alone (no chain)**: Rejected —
  two concurrent `saveAll` calls can still interleave their `await` points
  and produce lost-update bugs.

## Decision 7: List ordering implementation

**Decision**: `task-service.list()` produces the ordering defined by
FR-004a in one pass:

1. Partition tasks into `overdueOpen`, `otherOpen`, `completed`.
2. Sort `overdueOpen` by `dueDate` ascending.
3. Sort `otherOpen` by (`dueDate ?? +Infinity`) ascending (nulls last).
4. Sort `completed` by `completedAt` descending.
5. Concatenate in that order.

Overdue is evaluated once at the start of the call against `today` in local
timezone; the same `today` is used for every task in the response, avoiding a
race where a midnight boundary flips one task but not another mid-loop.

**Rationale**: Deterministic, testable, and O(n log n) which is well within
SC-004's 100 ms budget at 1,000 tasks.

---

## Open questions

None.
