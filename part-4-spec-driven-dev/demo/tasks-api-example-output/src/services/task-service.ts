import * as crypto from "node:crypto";
import type { Task, TaskRepository } from "../repositories/task-repository.js";
import { NotFoundError, ValidationError } from "../errors.js";

export interface CreateTaskInput {
  title: string;
  dueDate?: string | null;
}

export type TaskView = Task & { overdue: boolean };

export interface TaskService {
  create(input: CreateTaskInput): Promise<TaskView>;
  list(): Promise<TaskView[]>;
  complete(id: string): Promise<TaskView>;
  remove(id: string): Promise<void>;
}

export interface TaskServiceDeps {
  repository: TaskRepository;
  now?: () => Date;
  /** For deterministic id generation in tests. */
  generateId?: () => string;
}

const MAX_TITLE_LENGTH = 500;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function createTaskService(deps: TaskServiceDeps): TaskService {
  const { repository } = deps;
  const now = deps.now ?? (() => new Date());
  const generateId = deps.generateId ?? (() => crypto.randomUUID());

  // In-memory cache seeded from disk on first access. Every mutation writes
  // the full task list back via repository.saveAll.
  let cache: Task[] | null = null;

  async function ensureLoaded(): Promise<Task[]> {
    if (cache !== null) return cache;
    const store = await repository.load();
    cache = store.tasks;
    return cache;
  }

  function validateCreate(input: CreateTaskInput): {
    title: string;
    dueDate: string | null;
  } {
    if (typeof input.title !== "string") {
      throw new ValidationError("title is required", [
        { path: "title", message: "must be a string" },
      ]);
    }
    const title = input.title.trim();
    if (title.length === 0) {
      throw new ValidationError("title must not be empty", [
        { path: "title", message: "must not be empty" },
      ]);
    }
    if (title.length > MAX_TITLE_LENGTH) {
      throw new ValidationError("title too long", [
        {
          path: "title",
          message: `must be ${MAX_TITLE_LENGTH} characters or fewer`,
        },
      ]);
    }
    let dueDate: string | null = null;
    if (input.dueDate !== undefined && input.dueDate !== null) {
      dueDate = normalizeDueDate(input.dueDate);
    }
    return { title, dueDate };
  }

  function normalizeDueDate(raw: string): string {
    if (typeof raw !== "string" || !DATE_RE.test(raw)) {
      throw new ValidationError("invalid dueDate", [
        { path: "dueDate", message: "must be YYYY-MM-DD" },
      ]);
    }
    // Validate real calendar date (rejects Feb 30 etc.).
    const [y, m, d] = raw.split("-").map((s) => Number.parseInt(s, 10)) as [
      number,
      number,
      number
    ];
    const asDate = new Date(Date.UTC(y, m - 1, d));
    if (
      asDate.getUTCFullYear() !== y ||
      asDate.getUTCMonth() !== m - 1 ||
      asDate.getUTCDate() !== d
    ) {
      throw new ValidationError("invalid dueDate", [
        { path: "dueDate", message: "not a real calendar date" },
      ]);
    }
    return raw;
  }

  function todayLocalDateString(nowDate: Date): string {
    // "Today" in the server's local timezone (spec Q5).
    const y = nowDate.getFullYear();
    const m = String(nowDate.getMonth() + 1).padStart(2, "0");
    const d = String(nowDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function toView(t: Task, today: string): TaskView {
    const overdue =
      t.status === "open" && t.dueDate !== null && t.dueDate < today;
    return { ...t, overdue };
  }

  function requireUuid(id: string): void {
    if (!UUID_V4_RE.test(id)) {
      throw new NotFoundError("task not found");
    }
  }

  async function create(input: CreateTaskInput): Promise<TaskView> {
    const { title, dueDate } = validateCreate(input);
    const tasks = await ensureLoaded();
    const task: Task = {
      id: generateId(),
      title,
      dueDate,
      status: "open",
      createdAt: now().toISOString(),
      completedAt: null,
    };
    const next = [...tasks, task];
    await repository.saveAll(next);
    cache = next;
    return toView(task, todayLocalDateString(now()));
  }

  async function list(): Promise<TaskView[]> {
    const tasks = await ensureLoaded();
    const today = todayLocalDateString(now());
    const views = tasks.map((t) => toView(t, today));

    // FR-004a ordering: overdue open (due asc), remaining open (due asc,
    // no-due last), completed (completedAt desc).
    const overdueOpen: TaskView[] = [];
    const otherOpen: TaskView[] = [];
    const completed: TaskView[] = [];
    for (const v of views) {
      if (v.status === "complete") completed.push(v);
      else if (v.overdue) overdueOpen.push(v);
      else otherOpen.push(v);
    }

    overdueOpen.sort((a, b) => compareDueAsc(a.dueDate, b.dueDate));
    otherOpen.sort((a, b) => compareDueAscNullsLast(a.dueDate, b.dueDate));
    completed.sort((a, b) => compareCompletedDesc(a.completedAt, b.completedAt));

    return [...overdueOpen, ...otherOpen, ...completed];
  }

  async function complete(id: string): Promise<TaskView> {
    requireUuid(id);
    const tasks = await ensureLoaded();
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx === -1) throw new NotFoundError("task not found");
    const existing = tasks[idx]!;
    if (existing.status === "complete") {
      // Idempotent no-op: do NOT persist.
      return toView(existing, todayLocalDateString(now()));
    }
    const updated: Task = {
      ...existing,
      status: "complete",
      completedAt: now().toISOString(),
    };
    const next = tasks.slice();
    next[idx] = updated;
    await repository.saveAll(next);
    cache = next;
    return toView(updated, todayLocalDateString(now()));
  }

  async function remove(id: string): Promise<void> {
    requireUuid(id);
    const tasks = await ensureLoaded();
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx === -1) throw new NotFoundError("task not found");
    const next = tasks.slice(0, idx).concat(tasks.slice(idx + 1));
    await repository.saveAll(next);
    cache = next;
  }

  return { create, list, complete, remove };
}

function compareDueAsc(a: string | null, b: string | null): number {
  // Both non-null when called on the overdueOpen partition.
  const aa = a ?? "";
  const bb = b ?? "";
  return aa < bb ? -1 : aa > bb ? 1 : 0;
}

function compareDueAscNullsLast(
  a: string | null,
  b: string | null
): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareCompletedDesc(
  a: string | null,
  b: string | null
): number {
  const aa = a ?? "";
  const bb = b ?? "";
  return aa < bb ? 1 : aa > bb ? -1 : 0;
}
