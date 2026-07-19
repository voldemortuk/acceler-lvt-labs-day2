# Feature Specification: Tasks API (Single-User, No Auth)

**Feature Branch**: `001-tasks-api`

**Created**: 2026-07-01

**Status**: Draft

**Input**: User description: "Build a small Tasks API that lets a single user create tasks with a title and an optional due date, list their tasks, mark one complete, and delete one. Users need to see overdue tasks at a glance and never lose data on a crash. There is no authentication in this release — one user, one process."

## Clarifications

### Session 2026-07-01

- Q: In what order does the list endpoint return tasks? → A: Overdue open first (due asc), then remaining open (due asc, no-due last), then completed last (completion time desc).
- Q: What format are task identifiers? → A: UUID v4 strings.
- Q: What is the minimum observability bar? → A: Structured JSON logs to stdout for every request outcome, every persistence write (success/failure with error class), and every startup/shutdown event. No metrics endpoint in this release.
- Q: What happens when the store file exists but is unreadable/corrupted on startup? → A: Refuse to start, rename the bad file to `<store>.corrupt.<ISO-timestamp>`, log the rename, then exit non-zero. A subsequent start sees no store and initializes empty.
- Q: Which timezone defines "today" for the overdue calculation? → A: Server local timezone; the effective timezone name is included in the startup log line.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Capture and list tasks (Priority: P1)

The user opens the API and starts capturing things they need to do. They add a
task by providing at minimum a title, optionally with a due date. They can list
every task they've captured so far, seeing which are still open and which are
already complete.

**Why this priority**: Without create and list, the product has zero value.
This is the smallest slice that makes the API usable end-to-end.

**Independent Test**: Start the service with an empty store, create three
tasks (one with a due date, two without), list them, and verify all three
appear with the correct titles, due dates, and a default "open" status.

**Acceptance Scenarios**:

1. **Given** an empty task store, **When** the user submits a task with title "Buy milk" and no due date, **Then** the task is stored and returned in subsequent list calls with status "open".
2. **Given** an empty task store, **When** the user submits a task with title "File taxes" and a due date of 2026-04-15, **Then** the task is stored with that due date and appears in the list.
3. **Given** two previously created tasks, **When** the user requests the task list, **Then** both tasks are returned with a stable identifier for each.
4. **Given** the user submits a task with an empty or whitespace-only title, **When** the request is processed, **Then** the request is rejected with a clear validation error and nothing is stored.

---

### User Story 2 - Never lose data across crashes (Priority: P1)

The user has captured tasks and expects them to still be there tomorrow — even
if the process crashes, the machine loses power, or the service is killed
mid-write. When the service restarts, every task that was successfully
acknowledged as created, completed, or deleted must still reflect that state,
and no task may be observed in a half-written or corrupted form.

**Why this priority**: This is a stated non-negotiable requirement from the
user ("never lose data on a crash"). It is P1 because a task tracker that can
silently lose entries is worse than no tracker at all.

**Independent Test**: Create N tasks, kill the process abruptly (e.g., SIGKILL)
at arbitrary points during a write, restart the service, list the tasks, and
verify the store is always in a consistent state — either the write was fully
applied or fully not applied. No partially written or unreadable records may
appear.

**Acceptance Scenarios**:

1. **Given** a task has been created and the create response has been returned to the user, **When** the process is restarted, **Then** that task appears in the next list response with the same identifier and fields.
2. **Given** a task creation is interrupted before a success response is returned, **When** the process is restarted, **Then** the store is readable and contains either the fully written task or no trace of it — never a corrupted or partial record.
3. **Given** the store file exists from a prior run, **When** the service starts, **Then** it loads all previously persisted tasks and serves them without data loss.

---

### User Story 3 - Mark complete and delete (Priority: P2)

Once a task is done, the user marks it complete so it no longer clutters their
open work. If a task was captured by mistake or is no longer relevant, the
user deletes it outright.

**Why this priority**: Complete and delete are essential for keeping the list
useful over time, but a first release could theoretically demo with just
create and list. They come immediately after P1.

**Independent Test**: Create two tasks, mark one complete, delete the other,
then list — the completed one appears with status "complete" and the deleted
one is gone.

**Acceptance Scenarios**:

1. **Given** an existing open task, **When** the user marks it complete, **Then** subsequent list responses show that task with status "complete" and it survives a restart.
2. **Given** an existing task, **When** the user deletes it, **Then** it no longer appears in list responses and it does not reappear after a restart.
3. **Given** a task identifier that does not exist, **When** the user attempts to mark it complete or delete it, **Then** the request is rejected with a clear "not found" error and no other task is affected.
4. **Given** a task that is already complete, **When** the user marks it complete again, **Then** the operation is a no-op and returns success (idempotent).

---

### User Story 4 - See overdue tasks at a glance (Priority: P2)

The user wants to know immediately which tasks are overdue — that is, still
open and past their due date — without having to sort or scan the whole list
manually.

**Why this priority**: Explicitly called out by the user ("see overdue tasks
at a glance"). It builds directly on User Story 1 and is a small, well-scoped
addition, so P2.

**Independent Test**: Create tasks with due dates in the past, in the future,
and with no due date. Request the task list and confirm each task carries a
clear overdue indicator, and that overdue status is derived correctly relative
to the current date.

**Acceptance Scenarios**:

1. **Given** an open task with a due date earlier than today, **When** the user lists tasks, **Then** that task is flagged as overdue.
2. **Given** an open task with a due date of today or later, **When** the user lists tasks, **Then** that task is not flagged as overdue.
3. **Given** a task with no due date, **When** the user lists tasks, **Then** that task is not flagged as overdue.
4. **Given** a task that is past its due date but has status "complete", **When** the user lists tasks, **Then** that task is not flagged as overdue.

---

### Edge Cases

- **Empty or whitespace title**: Rejected at creation with a validation error; no record is created.
- **Very long title**: Titles beyond a reasonable maximum length (see Assumptions) are rejected with a validation error.
- **Due date in the past at creation time**: Allowed — the task is created and immediately flagged overdue on the next list.
- **Malformed due date**: Rejected with a validation error indicating the expected date format.
- **Operations on unknown task identifiers**: Complete and delete return a "not found" error; list is unaffected.
- **Concurrent writes within the single process**: Serialized so no two writes can corrupt each other, since this release assumes one process.
- **Store file missing on startup**: Treated as an empty store; the first write creates it atomically.
- **Store file present but unreadable/corrupted**: Startup renames the bad file to `<store>.corrupt.<ISO-timestamp>`, logs the event, and exits non-zero so the operator can restore from backup before the next start. The quarantined file is never overwritten.
- **Clock changes / timezone**: "Overdue" is evaluated against the server's current calendar date in the server's local timezone at read time. The effective timezone is logged on startup so an operator can reason about when tasks flip to overdue.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow creation of a task with a required non-empty title and an optional due date.
- **FR-002**: System MUST reject task creation when the title is missing, empty, or only whitespace, and return a clear validation error.
- **FR-003**: System MUST assign each created task a stable, unique identifier that does not change for the lifetime of the task. Identifiers MUST be UUID v4 strings (canonical 8-4-4-4-12 hyphenated form) generated server-side; client-supplied identifiers MUST be ignored.
- **FR-004**: System MUST allow the user to list all tasks, returning for each task its identifier, title, due date (if any), status (open or complete), and an overdue indicator.
- **FR-004a**: The list response MUST be ordered as follows: (1) overdue open tasks first, sorted by due date ascending; (2) then the remaining open tasks, sorted by due date ascending, with tasks that have no due date placed at the end of the open group; (3) then completed tasks last, sorted by completion time descending (most recently completed first).
- **FR-005**: System MUST allow the user to mark an existing task as complete by its identifier.
- **FR-006**: Marking a task complete MUST be idempotent — repeating the operation on an already-complete task MUST succeed without changing state.
- **FR-007**: System MUST allow the user to delete an existing task by its identifier.
- **FR-008**: Operations that reference a non-existent identifier (complete, delete) MUST return a clear "not found" error and leave all other tasks unchanged.
- **FR-009**: System MUST flag a task as overdue in the list response if and only if the task is open AND has a due date strictly earlier than the current date. "Current date" MUST be evaluated in the server's local timezone (the process's effective timezone). The effective IANA timezone name (or the offset if no IANA name is available) MUST be included in the startup log line.
- **FR-010**: System MUST persist every acknowledged create, complete, and delete operation such that it survives process restart.
- **FR-011**: System MUST perform every persistent write atomically — after any crash, the persisted state MUST reflect either the pre-write state or the fully applied post-write state, never a partial or corrupted state.
- **FR-012**: On startup, System MUST load all previously persisted tasks and expose them via the list operation without loss.
- **FR-013**: If the persistent store exists but cannot be read or parsed on startup, System MUST (a) rename the bad file to `<store-path>.corrupt.<ISO-8601-timestamp>` so its contents are preserved for forensics and never overwritten, (b) emit a structured log line describing the failure and the new file path, and (c) exit with a non-zero status code without initializing an empty store on that same launch. A subsequent launch, seeing no store file, MUST initialize an empty store normally.
- **FR-014**: System MUST NOT require or perform any user authentication or authorization in this release — every caller is treated as the single owner of every task.
- **FR-015**: System MUST serialize concurrent write operations within the single process so that they cannot interleave and produce a corrupted persisted state.
- **FR-016**: System MUST emit one structured JSON log line to stdout per request outcome, including at minimum: timestamp, operation (create/list/complete/delete), outcome (success or error class), and task identifier where applicable.
- **FR-017**: System MUST emit one structured JSON log line to stdout per persistence write attempt, including at minimum: timestamp, operation, outcome (success or error class name), and, on failure, the error message.
- **FR-018**: System MUST emit one structured JSON log line to stdout on startup (indicating whether the store existed and how many tasks were loaded) and one on graceful shutdown.
- **FR-019**: System MUST NOT expose a metrics endpoint, health endpoint, or any observability surface beyond stdout logs in this release.

### Key Entities

- **Task**: Represents a single unit of work the user wants to track.
  - Attributes: identifier (UUID v4 string, stable, unique, server-assigned), title (non-empty string), due date (optional calendar date), status (open or complete), created-at timestamp, completed-at timestamp (present only when status is complete).
  - Derived at read time: overdue indicator (open + due date before today).
- **Task Store**: The single persistent collection of all Task records for the one user of this release. Has exactly one on-disk representation that is updated atomically.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can create their first task and see it in the list within one round-trip pair (one create, one list), with no configuration beyond starting the service.
- **SC-002**: After any abrupt process termination during normal use, restarting the service leaves 100% of previously acknowledged tasks intact and 0% partially written or unreadable — verified by a crash-during-write test that runs at least 50 iterations without a single corrupted store.
- **SC-003**: In a list response for a store containing at least 100 tasks mixing open, complete, past-due, and future-due entries, 100% of open+past-due tasks carry `overdue: true`, 0% of other tasks carry `overdue: true`, and every overdue task appears in the response before any non-overdue open task (per FR-004a) — no client-side filtering or sorting required.
- **SC-004**: Every operation (create, list, complete, delete) responds in under 100 ms at a store size of 1,000 tasks on a typical developer laptop.
- **SC-005**: Attempting complete or delete on an unknown identifier returns a clear "not found" outcome in 100% of cases and never modifies any other task.
- **SC-006**: Zero tasks are lost across 100 consecutive restart cycles under a workload that mixes creates, completes, and deletes.

## Assumptions

- **Single user, single process**: There is exactly one caller and exactly one running instance of the service at a time. Multi-process or multi-writer safety is out of scope for this release.
- **No authentication in this release**: The API is deployed in a trusted local environment (e.g., localhost) where callers are implicitly trusted. Adding auth is a future concern.
- **Persistence is local file-backed**: Given the single-process, single-user scope, a local file (updated via atomic write-and-rename) is the assumed storage mechanism. No external database is required.
- **Due date is a calendar date, not a timestamp**: "Overdue" is evaluated day-granular against the server's current date in the server's local timezone; sub-day time-of-day precision is out of scope for this release.
- **Reasonable title length limit**: Titles are capped at a sensible upper bound (e.g., 500 characters) to prevent pathological inputs; exact value is an implementation detail chosen during planning.
- **English-language, plain-text titles**: No rich text, markdown parsing, or localization requirements in this release.
- **Idempotent complete, non-idempotent delete on missing id**: Repeating complete on an already-complete task is a no-op success; delete on a missing id is a "not found" error (delete is not treated as idempotent in this release because the user asked for a clear error surface).
- **No pagination in v1**: The list operation returns all tasks. At the expected scale (single user), this is acceptable; pagination is a future enhancement.
