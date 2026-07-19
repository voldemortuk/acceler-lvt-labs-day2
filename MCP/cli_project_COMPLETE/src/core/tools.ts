import type Anthropic from "@anthropic-ai/sdk";
import type { Tool as McpTool } from "@modelcontextprotocol/sdk/types.js";
import type { MCPClient } from "../mcpClient.js";

type ToolResultStatus = "success" | "error";

export function buildToolResultPart(
  toolUseId: string,
  text: string,
  status: ToolResultStatus
): Anthropic.ToolResultBlockParam {
  return {
    tool_use_id: toolUseId,
    type: "tool_result",
    content: text,
    is_error: status === "error",
  };
}

export class ToolManager {
  static async getAllTools(
    clients: Record<string, MCPClient>
  ): Promise<Anthropic.Tool[]> {
    const tools: Anthropic.Tool[] = [];
    for (const client of Object.values(clients)) {
      const toolModels = await client.listTools();
      for (const t of toolModels) {
        tools.push({
          name: t.name,
          description: t.description,
          input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
        });
      }
    }
    return tools;
  }

  private static async findClientWithTool(
    clients: MCPClient[],
    toolName: string
  ): Promise<MCPClient | null> {
    for (const client of clients) {
      const tools = await client.listTools();
      const found = tools.find((t: McpTool) => t.name === toolName);
      if (found) {
        return client;
      }
    }
    return null;
  }

  static async executeToolRequests(
    clients: Record<string, MCPClient>,
    message: Anthropic.Message
  ): Promise<Anthropic.ToolResultBlockParam[]> {
    const toolRequests = message.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    const toolResultBlocks: Anthropic.ToolResultBlockParam[] = [];
    for (const toolRequest of toolRequests) {
      const toolUseId = toolRequest.id;
      const toolName = toolRequest.name;
      const toolInput = toolRequest.input as Record<string, unknown>;

      const client = await this.findClientWithTool(
        Object.values(clients),
        toolName
      );

      if (!client) {
        toolResultBlocks.push(
          buildToolResultPart(toolUseId, "Could not find that tool", "error")
        );
        continue;
      }

      try {
        const toolOutput = await client.callTool(toolName, toolInput);
        const items = toolOutput.content ?? [];
        const contentList = items
          .filter(
            (item): item is { type: "text"; text: string } =>
              item.type === "text"
          )
          .map((item) => item.text);
        const contentJson = JSON.stringify(contentList);
        toolResultBlocks.push(
          buildToolResultPart(
            toolUseId,
            contentJson,
            toolOutput.isError ? "error" : "success"
          )
        );
      } catch (error) {
        const errorMessage = `Error executing tool '${toolName}': ${
          error instanceof Error ? error.message : String(error)
        }`;
        console.error(errorMessage);
        toolResultBlocks.push(
          buildToolResultPart(
            toolUseId,
            JSON.stringify({ error: errorMessage }),
            "error"
          )
        );
      }
    }
    return toolResultBlocks;
  }
}
