import type Anthropic from "@anthropic-ai/sdk";
import { Claude } from "./claude.js";
import { ToolManager } from "./tools.js";
import type { MCPClient } from "../mcpClient.js";

export class Chat {
  protected readonly claudeService: Claude;
  protected readonly clients: Record<string, MCPClient>;
  protected messages: Anthropic.MessageParam[] = [];

  constructor(claudeService: Claude, clients: Record<string, MCPClient>) {
    this.claudeService = claudeService;
    this.clients = clients;
  }

  protected async processQuery(query: string): Promise<void> {
    this.messages.push({ role: "user", content: query });
  }

  async run(query: string): Promise<string> {
    let finalTextResponse = "";

    await this.processQuery(query);

    for (;;) {
      const tools = await ToolManager.getAllTools(this.clients);
      const response = await this.claudeService.chat({
        messages: this.messages,
        tools,
      });

      this.claudeService.addAssistantMessage(this.messages, response);

      if (response.stop_reason === "tool_use") {
        console.log(this.claudeService.textFromMessage(response));
        const toolResultParts = await ToolManager.executeToolRequests(
          this.clients,
          response
        );
        this.claudeService.addUserMessage(this.messages, toolResultParts);
      } else {
        finalTextResponse = this.claudeService.textFromMessage(response);
        break;
      }
    }

    return finalTextResponse;
  }
}
