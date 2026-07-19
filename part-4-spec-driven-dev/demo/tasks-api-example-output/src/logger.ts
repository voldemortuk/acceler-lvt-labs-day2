/**
 * Structured JSON stdout logger per constitution IV (one responsibility)
 * and spec FR-016..FR-018. One event per call; one line per event.
 */

export type LogFields = Record<string, unknown>;

export interface Logger {
  log(event: string, fields?: LogFields): void;
}

export interface LoggerOptions {
  /** Sink for testing; defaults to `process.stdout.write`. */
  write?: (line: string) => void;
  /** Clock for testing; defaults to `() => new Date()`. */
  now?: () => Date;
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const write = options.write ?? ((line) => process.stdout.write(line));
  const now = options.now ?? (() => new Date());
  return {
    log(event, fields = {}) {
      const record: LogFields = {
        timestamp: now().toISOString(),
        event,
        ...fields,
      };
      write(JSON.stringify(record) + "\n");
    },
  };
}
