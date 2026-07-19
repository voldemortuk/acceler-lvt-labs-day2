# Sample project — Plan Mode demo

A tiny Express service with **one deliberately messy handler** in `src/api/orders.ts`. Everything is jammed together: HTTP parsing, validation, database access via an in-memory client, response formatting, and logging.

This is the target of the [Plan Mode demo](../README.md). The demo drives a refactor into three layers — **route · service · repository** — through Plan Mode so learners see the full Explore → Plan → Execute loop on a repo small enough to fit on one screen.

## Layout

```
sample-project/
├── src/
│   ├── api/orders.ts          # the messy handler to refactor
│   ├── db/client.ts           # in-memory "database"
│   └── index.ts               # server entry
├── tests/
│   └── orders.test.ts         # two green tests you must keep green
├── package.json
└── tsconfig.json
```

## Commands

```bash
pnpm install
pnpm test          # two tests should pass before you start
pnpm typecheck
```

## The refactor target

After the demo, the layout should look like:

```
src/
├── api/orders.ts              # HTTP only: parse, call service, format response
├── services/orders.ts         # business logic (module functions)
├── db/
│   ├── client.ts              # unchanged
│   └── repositories/orders.ts # data access only
└── index.ts                   # unchanged
```

Tests must still pass. That is the whole acceptance criterion — a green test suite proves the seams were correct.
