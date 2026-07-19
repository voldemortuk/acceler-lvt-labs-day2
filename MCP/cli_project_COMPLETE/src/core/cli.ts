import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type { Prompt } from "@modelcontextprotocol/sdk/types.js";
import type { CliChat } from "./cliChat.js";

interface NamedPrompt {
  name: string;
}

/**
 * Pure completion logic shared by the readline completer. Returns the list of
 * candidate completions for the current input line. Mirrors the three cases the
 * Python prompt-toolkit completer handled: @resource, /command, and
 * /command <arg> (argument = resource id).
 */
export function buildCompletions(
  line: string,
  prompts: NamedPrompt[],
  resources: string[]
): string[] {
  // @-mention: complete the token after the last "@".
  const atIndex = line.lastIndexOf("@");
  if (atIndex !== -1) {
    const prefix = line.slice(atIndex + 1);
    return resources.filter((id) =>
      id.toLowerCase().startsWith(prefix.toLowerCase())
    );
  }

  if (line.startsWith("/")) {
    const parts = line.slice(1).split(/\s+/);

    // "/cmd" (no trailing space, single token) → complete command names.
    if (parts.length <= 1 && !line.endsWith(" ")) {
      const cmdPrefix = parts[0] ?? "";
      return prompts
        .map((p) => p.name)
        .filter((name) => name.startsWith(cmdPrefix));
    }

    // "/cmd <argPrefix>" → complete the argument from resource ids.
    if (parts.length >= 2) {
      const docPrefix = parts[parts.length - 1];
      return resources.filter((id) =>
        id.toLowerCase().startsWith(docPrefix.toLowerCase())
      );
    }
  }

  return [];
}

export class CliApp {
  private readonly agent: CliChat;
  private resources: string[] = [];
  private prompts: Prompt[] = [];
  private rl: readline.Interface | null = null;

  constructor(agent: CliChat) {
    this.agent = agent;
  }

  async initialize(): Promise<void> {
    await this.refreshResources();
    await this.refreshPrompts();
  }

  private async refreshResources(): Promise<void> {
    try {
      this.resources = await this.agent.listDocIds();
    } catch (error) {
      console.error(`Error refreshing resources: ${String(error)}`);
    }
  }

  private async refreshPrompts(): Promise<void> {
    try {
      this.prompts = await this.agent.listPrompts();
    } catch (error) {
      console.error(`Error refreshing prompts: ${String(error)}`);
    }
  }

  private completer(line: string): [string[], string] {
    const completions = buildCompletions(line, this.prompts, this.resources);
    return [completions, line];
  }

  async run(): Promise<void> {
    this.rl = readline.createInterface({
      input: stdin,
      output: stdout,
      completer: (line: string) => this.completer(line),
    });

    try {
      for (;;) {
        let userInput: string;
        try {
          userInput = await this.rl.question("> ");
        } catch {
          // Ctrl-C / EOF rejects the question promise; exit cleanly.
          break;
        }

        if (userInput.trim() === "") {
          continue;
        }

        const response = await this.agent.run(userInput);
        console.log(`\nResponse:\n${response}`);
      }
    } finally {
      this.rl.close();
      this.rl = null;
    }
  }
}
