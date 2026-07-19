/**
 * Typed error hierarchy per constitution III (Errors As Values).
 * All domain errors extend AppError; the HTTP error-mapper branches on
 * `instanceof` to produce status codes. Never throw plain strings.
 */

export interface ValidationIssue {
  path: string;
  message: string;
}

export abstract class AppError extends Error {
  public override readonly name: string;

  constructor(name: string, message: string) {
    super(message);
    this.name = name;
    // Preserve prototype chain across transpilation targets.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  public readonly details: ValidationIssue[];

  constructor(message: string, details: ValidationIssue[] = []) {
    super("ValidationError", message);
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(message = "not found") {
    super("NotFoundError", message);
  }
}

export class StoreCorruptError extends AppError {
  public readonly quarantinedPath: string | null;

  constructor(message: string, quarantinedPath: string | null = null) {
    super("StoreCorruptError", message);
    this.quarantinedPath = quarantinedPath;
  }
}

export class StoreWriteError extends AppError {
  constructor(message: string) {
    super("StoreWriteError", message);
  }
}
