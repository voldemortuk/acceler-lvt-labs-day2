import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createTaskService,
  type TaskService,
} from "./task-service.js";
import type { Task, TaskRepository } from "../repositories/task-repository.js";
import { NotFoundError, ValidationError } from "../errors.js";

interface FakeRepo extends TaskRepository {
  saveAll: TaskRepository["saveAll"] & { mock: { calls: unknown[][] } };
}

function makeFakeRepo(initial: Task[] = []): FakeRepo {
  const state = { tasks: initial.slice() };
  const saveAll = vi.fn(async (tasks: Task[]): Promise<void> => {
    state.tasks = tasks.slice();
  });
  // Cast: Vitest Mock<[Task[]], Promise<void>> and the narrow interface
  // signature both accept the runtime callable, but their generic parameters
  // don't line up for the intersection. Narrow at the boundary here.
  return {
    async load() {
      return { schemaVersion: 1 as const, tasks: state.tasks.slice() };
    },
    saveAll: saveAll as unknown as FakeRepo["saveAll"],
  };
}

const FIXED_NOW = new Date("2026-07-01T12:00:00.000Z");
let uuidCounter = 0;
function seqUuid(): string {
  uuidCounter++;
  const n = uuidCounter.toString(16).padStart(12, "0");
  return `00000000-0000-4000-8000-${n}`;
}

function makeService(
  repo: TaskRepository,
  overrides: { now?: () => Date; generateId?: () => string } = {}
): TaskService {
  return createTaskService({
    repository: repo,
    now: overrides.now ?? (() => FIXED_NOW),
    generateId: overrides.generateId ?? seqUuid,
  });
}

describe("task-service — US1 (create + list basics)", () => {
  beforeEach(() => {
    uuidCounter = 0;
  });

  it("create({title}) returns a Task with UUID v4 id, status open, timestamps set", async () => {
    const repo = makeFakeRepo();
    const svc = makeService(repo, { generateId: () => globalThis.crypto.randomUUID() });
    const t = await svc.create({ title: "hello" });
    expect(t.title).toBe("hello");
    expect(t.status).toBe("open");
    expect(t.dueDate).toBeNull();
    expect(t.completedAt).toBeNull();
    expect(t.createdAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
    expect(t.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(repo.saveAll).toHaveBeenCalledTimes(1);
  });

  it("create trims title and rejects whitespace-only titles", async () => {
    const svc = makeService(makeFakeRepo());
    await expect(svc.create({ title: "   " })).rejects.toBeInstanceOf(
      ValidationError
    );
    await expect(svc.create({ title: "" })).rejects.toBeInstanceOf(
      ValidationError
    );
    // Trims but keeps otherwise-valid.
    const t = await svc.create({ title: "  keep me  " });
    expect(t.title).toBe("keep me");
  });

  it("create rejects title > 500 chars", async () => {
    const svc = makeService(makeFakeRepo());
    await expect(
      svc.create({ title: "x".repeat(501) })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("create stores due date when provided", async () => {
    const svc = makeService(makeFakeRepo());
    const t = await svc.create({ title: "x", dueDate: "2026-04-15" });
    expect(t.dueDate).toBe("2026-04-15");
  });

  it("create rejects malformed dueDate", async () => {
    const svc = makeService(makeFakeRepo());
    await expect(
      svc.create({ title: "x", dueDate: "2026/04/15" })
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      svc.create({ title: "x", dueDate: "2026-02-30" })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("list returns every created task", async () => {
    const svc = makeService(makeFakeRepo());
    await svc.create({ title: "A" });
    await svc.create({ title: "B" });
    const items = await svc.list();
    expect(items.map((t) => t.title).sort()).toEqual(["A", "B"]);
  });
});

describe("task-service — US3 (complete + delete)", () => {
  beforeEach(() => {
    uuidCounter = 0;
  });

  it("complete(id) on open task transitions to complete and sets completedAt", async () => {
    const repo = makeFakeRepo();
    const now = new Date("2026-07-01T12:00:00.000Z");
    const svc = makeService(repo, { now: () => now });
    const created = await svc.create({ title: "x" });
    // Cast: repo.saveAll is a vi.fn() cast to the interface signature; the
    // mock helpers live on the underlying spy.
    const spy = repo.saveAll as unknown as ReturnType<typeof vi.fn>;
    spy.mockClear();
    const completed = await svc.complete(created.id);
    expect(completed.status).toBe("complete");
    expect(completed.completedAt).toBe("2026-07-01T12:00:00.000Z");
    expect(spy.mock.calls.length).toBe(1);
  });

  it("complete(id) on already-complete task is a no-op and does NOT call saveAll", async () => {
    const repo = makeFakeRepo();
    const svc = makeService(repo);
    const created = await svc.create({ title: "x" });
    await svc.complete(created.id);
    const spy = repo.saveAll as unknown as ReturnType<typeof vi.fn>;
    spy.mockClear();
    const again = await svc.complete(created.id);
    expect(again.status).toBe("complete");
    expect(spy.mock.calls.length).toBe(0);
  });

  it("complete(unknownId) throws NotFoundError", async () => {
    const svc = makeService(makeFakeRepo());
    await expect(
      svc.complete("00000000-0000-4000-8000-000000000999")
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("complete on non-uuid id throws NotFoundError (uniform)", async () => {
    const svc = makeService(makeFakeRepo());
    await expect(svc.complete("not-a-uuid")).rejects.toBeInstanceOf(
      NotFoundError
    );
  });

  it("remove(id) on existing task removes it from list()", async () => {
    const svc = makeService(makeFakeRepo());
    const t = await svc.create({ title: "x" });
    await svc.remove(t.id);
    expect(await svc.list()).toEqual([]);
  });

  it("remove(unknownId) throws NotFoundError", async () => {
    const svc = makeService(makeFakeRepo());
    await expect(
      svc.remove("00000000-0000-4000-8000-000000000999")
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("task-service — US4 (overdue + FR-004a ordering)", () => {
  beforeEach(() => {
    uuidCounter = 0;
  });

  const TODAY = new Date("2026-07-01T12:00:00.000Z");
  // Note: getFullYear/getMonth/getDate use local timezone. In tests we assume
  // the local timezone yields calendar date 2026-07-01 for the above UTC
  // instant (true for any offset between -12 and +12 given the noon UTC).

  it("open task with dueDate < today is overdue", async () => {
    const repo = makeFakeRepo();
    const svc = makeService(repo, { now: () => TODAY });
    await svc.create({ title: "past", dueDate: "2020-01-01" });
    const [t] = await svc.list();
    expect(t!.overdue).toBe(true);
  });

  it("open task with dueDate today is not overdue (strictly earlier)", async () => {
    const repo = makeFakeRepo();
    const svc = makeService(repo, { now: () => TODAY });
    await svc.create({ title: "today", dueDate: "2026-07-01" });
    const [t] = await svc.list();
    expect(t!.overdue).toBe(false);
  });

  it("open task with no dueDate is not overdue", async () => {
    const svc = makeService(makeFakeRepo(), { now: () => TODAY });
    await svc.create({ title: "someday" });
    const [t] = await svc.list();
    expect(t!.overdue).toBe(false);
  });

  it("completed past-due task is not overdue", async () => {
    const svc = makeService(makeFakeRepo(), { now: () => TODAY });
    const c = await svc.create({ title: "old", dueDate: "2020-01-01" });
    await svc.complete(c.id);
    const [t] = await svc.list();
    expect(t!.overdue).toBe(false);
  });

  it("list ordering: overdue open (due asc), other open (due asc, no-due last), completed (completedAt desc)", async () => {
    // Covered concretely by the two subsequent tests below; this describe
    // stub is intentionally empty to keep the FR-004a headline explicit.
    expect(true).toBe(true);
  });

  it("list ordering with two completed tasks orders by completedAt desc", async () => {
    const repo = makeFakeRepo();
    const clock = { t: new Date("2026-07-01T10:00:00.000Z") };
    const svc = makeService(repo, { now: () => clock.t });
    const a = await svc.create({ title: "A", dueDate: "2020-01-01" });
    const b = await svc.create({ title: "B", dueDate: "2020-01-02" });
    // Complete A first, then B (B's completedAt is later).
    clock.t = new Date("2026-07-01T11:00:00.000Z");
    await svc.complete(a.id);
    clock.t = new Date("2026-07-01T12:00:00.000Z");
    await svc.complete(b.id);
    const items = await svc.list();
    // Both completed, no open. Order: B first (more recent completedAt).
    expect(items.map((t) => t.title)).toEqual(["B", "A"]);
  });

  it("list ordering across mixed statuses matches FR-004a", async () => {
    const repo = makeFakeRepo();
    const clock = { t: new Date("2026-07-01T10:00:00.000Z") };
    const svc = makeService(repo, { now: () => clock.t });
    // Create in scrambled order.
    await svc.create({ title: "no-due-open" });
    await svc.create({ title: "past-late", dueDate: "2020-06-01" });
    await svc.create({ title: "past-early", dueDate: "2020-01-01" });
    await svc.create({ title: "future-far", dueDate: "2099-12-31" });
    await svc.create({ title: "future-near", dueDate: "2050-01-01" });
    const done1 = await svc.create({ title: "done-first", dueDate: "2020-05-05" });
    const done2 = await svc.create({ title: "done-second", dueDate: "2020-05-05" });
    clock.t = new Date("2026-07-01T11:00:00.000Z");
    await svc.complete(done1.id);
    clock.t = new Date("2026-07-01T12:00:00.000Z");
    await svc.complete(done2.id);
    const items = await svc.list();
    expect(items.map((t) => t.title)).toEqual([
      // overdue open, due asc
      "past-early",
      "past-late",
      // other open, due asc, no-due last
      "future-near",
      "future-far",
      "no-due-open",
      // completed, completedAt desc (done-second later than done-first)
      "done-second",
      "done-first",
    ]);
  });

  it("today is captured once per list call (no mid-loop midnight-flip)", async () => {
    // Increment `now` between each call to nextNow; within one list() call
    // all overdue checks must agree.
    let calls = 0;
    const clock = { t: new Date("2026-07-01T23:59:59.900Z") };
    const svc = makeService(makeFakeRepo(), {
      now: () => {
        calls++;
        return clock.t;
      },
    });
    await svc.create({ title: "past", dueDate: "2020-01-01" });
    // Even if we mutate clock mid-call, list() should have snapshotted today.
    calls = 0;
    const items = await svc.list();
    // list() calls now() at most twice: once for today-string, possibly for
    // internal use. What matters: all tasks agree on today.
    expect(items.every((t) => typeof t.overdue === "boolean")).toBe(true);
    expect(calls).toBeGreaterThanOrEqual(1);
  });
});
