import { describe, it, expect } from "vitest";
import { buildToolResultPart } from "../src/core/tools.js";

describe("buildToolResultPart", () => {
  it("marks success results with is_error false", () => {
    const part = buildToolResultPart("tu_1", "hello", "success");
    expect(part).toEqual({
      tool_use_id: "tu_1",
      type: "tool_result",
      content: "hello",
      is_error: false,
    });
  });

  it("marks error results with is_error true", () => {
    const part = buildToolResultPart("tu_2", "boom", "error");
    expect(part.is_error).toBe(true);
    expect(part.tool_use_id).toBe("tu_2");
  });
});
