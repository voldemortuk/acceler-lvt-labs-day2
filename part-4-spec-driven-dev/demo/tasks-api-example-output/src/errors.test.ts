import { describe, it, expect } from "vitest";
import {
  AppError,
  NotFoundError,
  StoreCorruptError,
  StoreWriteError,
  ValidationError,
} from "./errors.js";

describe("errors", () => {
  it("every subclass is instanceof AppError and Error", () => {
    const errs: AppError[] = [
      new ValidationError("v"),
      new NotFoundError("n"),
      new StoreCorruptError("c"),
      new StoreWriteError("w"),
    ];
    for (const e of errs) {
      expect(e).toBeInstanceOf(AppError);
      expect(e).toBeInstanceOf(Error);
    }
  });

  it("name matches the class name on each subclass", () => {
    expect(new ValidationError("v").name).toBe("ValidationError");
    expect(new NotFoundError().name).toBe("NotFoundError");
    expect(new StoreCorruptError("c").name).toBe("StoreCorruptError");
    expect(new StoreWriteError("w").name).toBe("StoreWriteError");
  });

  it("ValidationError.details round-trip", () => {
    const details = [
      { path: "title", message: "required" },
      { path: "dueDate", message: "invalid date" },
    ];
    const err = new ValidationError("bad body", details);
    expect(err.details).toEqual(details);
  });

  it("NotFoundError defaults to a sensible message", () => {
    expect(new NotFoundError().message).toBe("not found");
  });

  it("StoreCorruptError carries an optional quarantinedPath", () => {
    const err = new StoreCorruptError("bad", "/tmp/x.corrupt.T");
    expect(err.quarantinedPath).toBe("/tmp/x.corrupt.T");
    expect(new StoreCorruptError("bad").quarantinedPath).toBeNull();
  });

  it("instanceof discrimination works (no string-matching required)", () => {
    const err: AppError = new NotFoundError();
    expect(err instanceof NotFoundError).toBe(true);
    expect(err instanceof ValidationError).toBe(false);
  });
});
