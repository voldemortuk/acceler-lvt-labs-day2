import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import type { TaskService, TaskView } from "../services/task-service.js";
import { ValidationError } from "../errors.js";

const CreateTaskSchema = z.object({
  title: z.string(),
  dueDate: z.string().nullable().optional(),
});

function serialize(t: TaskView) {
  return {
    id: t.id,
    title: t.title,
    dueDate: t.dueDate,
    status: t.status,
    createdAt: t.createdAt,
    completedAt: t.completedAt,
    overdue: t.overdue,
  };
}

function tagOperation(name: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    (req as Request & { operation?: string }).operation = name;
    next();
  };
}

export function createTaskRouter(taskService: TaskService): Router {
  const router = Router();

  router.get("/", tagOperation("listTasks"), async (_req, res, next) => {
    try {
      const items = await taskService.list();
      res.status(200).json({ tasks: items.map(serialize) });
    } catch (err) {
      next(err);
    }
  });

  router.post("/", tagOperation("createTask"), async (req, res, next) => {
    try {
      const parsed = CreateTaskSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(
          "invalid request body",
          parsed.error.issues.map((i) => ({
            path: i.path.join(".") || "(root)",
            message: i.message,
          }))
        );
      }
      const t = await taskService.create({
        title: parsed.data.title,
        dueDate: parsed.data.dueDate ?? null,
      });
      res.status(201).json(serialize(t));
    } catch (err) {
      next(err);
    }
  });

  router.post(
    "/:id/complete",
    tagOperation("completeTask"),
    async (req, res, next) => {
      try {
        const t = await taskService.complete(req.params.id ?? "");
        res.status(200).json(serialize(t));
      } catch (err) {
        next(err);
      }
    }
  );

  router.delete("/:id", tagOperation("deleteTask"), async (req, res, next) => {
    try {
      await taskService.remove(req.params.id ?? "");
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
