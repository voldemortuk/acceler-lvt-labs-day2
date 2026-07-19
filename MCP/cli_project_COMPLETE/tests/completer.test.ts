import { describe, it, expect } from "vitest";
import { buildCompletions } from "../src/core/cli.js";

const prompts = [{ name: "format" }, { name: "summarize" }];
const resources = ["deposition.md", "report.pdf", "plan.md"];

describe("buildCompletions", () => {
  it("completes @-mentions by resource prefix", () => {
    expect(buildCompletions("Tell me about @dep", prompts, resources)).toEqual([
      "deposition.md",
    ]);
  });

  it("completes /commands by prompt-name prefix", () => {
    expect(buildCompletions("/for", prompts, resources)).toEqual(["format"]);
  });

  it("completes a command argument by resource prefix", () => {
    expect(buildCompletions("/format rep", prompts, resources)).toEqual([
      "report.pdf",
    ]);
  });

  it("returns nothing for plain text", () => {
    expect(buildCompletions("hello world", prompts, resources)).toEqual([]);
  });
});
