import { describe, it, expect } from "vitest";
import { loadConfig } from "./config.js";
import { ValidationError } from "./errors.js";

describe("config", () => {
  it("uses defaults when env is empty", () => {
    const cfg = loadConfig({});
    expect(cfg.port).toBe(3000);
    expect(cfg.storePath).toBe("./data/tasks.json");
  });

  it("respects PORT and STORE_PATH overrides", () => {
    const cfg = loadConfig({ PORT: "4000", STORE_PATH: "./tmp/t.json" });
    expect(cfg.port).toBe(4000);
    expect(cfg.storePath).toBe("./tmp/t.json");
  });

  it("throws ValidationError on non-numeric PORT", () => {
    expect(() => loadConfig({ PORT: "abc" })).toThrow(ValidationError);
  });

  it("throws ValidationError on out-of-range PORT", () => {
    expect(() => loadConfig({ PORT: "0" })).toThrow(ValidationError);
    expect(() => loadConfig({ PORT: "99999" })).toThrow(ValidationError);
  });

  it("empty string env values fall back to defaults", () => {
    const cfg = loadConfig({ PORT: "", STORE_PATH: "" });
    expect(cfg.port).toBe(3000);
    expect(cfg.storePath).toBe("./data/tasks.json");
  });
});
