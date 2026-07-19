import { z } from "zod";
import { ValidationError } from "./errors.js";

const ConfigSchema = z.object({
  PORT: z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === "" ? "3000" : v))
    .pipe(
      z
        .string()
        .regex(/^\d+$/, "PORT must be a positive integer")
        .transform((v) => Number.parseInt(v, 10))
        .refine((n) => n > 0 && n <= 65535, "PORT must be in 1..65535")
    ),
  STORE_PATH: z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === "" ? "./data/tasks.json" : v)),
});

export interface AppConfig {
  port: number;
  storePath: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = ConfigSchema.safeParse({
    PORT: env.PORT,
    STORE_PATH: env.STORE_PATH,
  });
  if (!parsed.success) {
    throw new ValidationError(
      "invalid configuration",
      parsed.error.issues.map((i) => ({
        path: i.path.join(".") || "(root)",
        message: i.message,
      }))
    );
  }
  return {
    port: parsed.data.PORT,
    storePath: parsed.data.STORE_PATH,
  };
}
