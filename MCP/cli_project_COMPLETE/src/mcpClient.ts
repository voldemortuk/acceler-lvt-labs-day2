import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type {
  CallToolResult,
  Prompt,
  PromptMessage,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

export interface MCPClientOptions {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export class MCPClient {
  private readonly command: string;
  private readonly args: string[];
  private readonly env?: Record<string, string>;
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;

  constructor({ command, args, env }: MCPClientOptions) {
    this.command = command;
    this.args = args;
    this.env = env;
  }

  async connect(): Promise<void> {
    this.transport = new StdioClientTransport({
      command: this.command,
      args: this.args,
      env: this.env,
    });
    this.client = new Client(
      { name: "mcp-chat", version: "1.0.0" },
      { capabilities: {} }
    );
    await this.client.connect(this.transport);
  }

  private session(): Client {
    if (this.client === null) {
      throw new Error("Client session not initialized. Call connect() first.");
    }
    return this.client;
  }

  async listTools(): Promise<Tool[]> {
    const result = await this.session().listTools();
    return result.tools;
  }

  async callTool(
    name: string,
    args?: Record<string, unknown>
  ): Promise<CallToolResult> {
    return (await this.session().callTool({
      name,
      arguments: args,
    })) as CallToolResult;
  }

  async listPrompts(): Promise<Prompt[]> {
    const result = await this.session().listPrompts();
    return result.prompts;
  }

  async getPrompt(
    name: string,
    args: Record<string, string>
  ): Promise<PromptMessage[]> {
    const result = await this.session().getPrompt({ name, arguments: args });
    return result.messages;
  }

  async readResource(uri: string): Promise<unknown> {
    const result = await this.session().readResource({ uri });
    const resource = result.contents[0];

    if (resource && "text" in resource && typeof resource.text === "string") {
      if (resource.mimeType === "application/json") {
        return JSON.parse(resource.text);
      }
      return resource.text;
    }
    return undefined;
  }

  async cleanup(): Promise<void> {
    if (this.client !== null) {
      await this.client.close();
    }
    this.client = null;
    this.transport = null;
  }
}
