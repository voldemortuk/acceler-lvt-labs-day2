import { describe, it, expect } from "vitest";
import { convertPromptMessageToMessageParam } from "../src/core/cliChat.js";
import type { PromptMessage } from "@modelcontextprotocol/sdk/types.js";

describe("convertPromptMessageToMessageParam", () => {
  it("converts a single text content prompt message", () => {
    const pm: PromptMessage = {
      role: "user",
      content: { type: "text", text: "hello world" },
    };
    expect(convertPromptMessageToMessageParam(pm)).toEqual({
      role: "user",
      content: "hello world",
    });
  });

  it("maps assistant role through", () => {
    const pm: PromptMessage = {
      role: "assistant",
      content: { type: "text", text: "hi" },
    };
    expect(convertPromptMessageToMessageParam(pm)).toEqual({
      role: "assistant",
      content: "hi",
    });
  });

  it("returns empty string content for non-text content", () => {
    const pm = {
      role: "user",
      content: { type: "image", data: "...", mimeType: "image/png" },
    } as unknown as PromptMessage;
    expect(convertPromptMessageToMessageParam(pm)).toEqual({
      role: "user",
      content: "",
    });
  });
});
