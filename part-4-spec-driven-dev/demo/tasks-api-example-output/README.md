# tasks-api

Single-user, single-process HTTP API for tracking tasks (create, list,
mark complete, delete) with an at-a-glance overdue indicator and
crash-safe persistence. Intended for local, single-machine use — this
release ships without authentication.

Full behavioral spec: [specs/001-tasks-api/spec.md](./specs/001-tasks-api/spec.md).

## Prerequisites

- Node.js 20 LTS (`node --version` → `v20.x`).
- npm 10+.

## Setup

```pwsh
npm install
```

## Test

```pwsh
npm test
```

Runs the full Vitest suite (~70+ tests) including the atomic-write crash
simulation and the 100-cycle restart preservation test.

To skip the perf suite on slow CI hardware:

```pwsh
$env:CI_SKIP_PERF="1"; npm test
```

## Run

```pwsh
npm run dev
```

Defaults: port `3000`, store `./data/tasks.json`. Override via
`PORT` and `STORE_PATH` env vars. On startup, one JSON log line is
emitted to stdout including the effective IANA timezone used for
"overdue" evaluation.

For end-to-end curl scenarios per user story, see
[specs/001-tasks-api/quickstart.md](./specs/001-tasks-api/quickstart.md).

## Notes

- No authentication, no metrics endpoint, no health endpoint (spec
  FR-014 / FR-019).
- Persistence is a single JSON file, updated via atomic
  temp+fsync+rename. If the file becomes unreadable on startup, it is
  renamed to `<store>.corrupt.<ISO-timestamp>` and the process exits
  non-zero rather than silently proceeding.
