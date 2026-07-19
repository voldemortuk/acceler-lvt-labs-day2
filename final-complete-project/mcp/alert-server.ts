import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { deliverAlert, readOutboxLines } from "../src/alerts/outbox";

const mcp = new McpServer({ name: "AlertMCP", version: "1.0.0" });

// Distinct dedupe namespace from alert-check.ts's stale-order-alerts caller
// (see src/alerts/outbox.ts's OutboxLine doc comment) — without this,
// send_alert and the automated stale-order check would silently suppress
// each other any time they touch the same order_id on the same day.
const SOURCE = "mcp-send-alert";

mcp.registerTool(
  "send_alert",
  {
    description:
      "Deliver an alert to the local outbox, going through the exact same delivery/dedupe path alert-check.ts uses (src/alerts/outbox.ts's deliverAlert) — no second implementation of the (order_id, dedupe_key) dedupe check exists.",
    inputSchema: {
      channel: z.string().describe("Delivery channel, e.g. #order-alerts"),
      order_id: z.number().int().describe("The order this alert concerns"),
      dedupe_key: z
        .string()
        .describe(
          "Second half of the (order_id, dedupe_key) dedupe pair — typically the UTC calendar day (YYYY-MM-DD) this alert is scoped to. Calling send_alert again with the same order_id and dedupe_key is a no-op."
        ),
      summary: z.string().describe("Short one-line summary of the alert"),
      body: z.string().describe("Full alert body/detail"),
    },
  },
  async ({ channel, order_id, dedupe_key, summary, body }) => {
    const line = {
      order_id,
      calendar_day: dedupe_key,
      source: SOURCE,
      channel,
      summary,
      body,
    };

    const outcome = await deliverAlert(line);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            delivered: outcome === "sent",
            outcome,
            order_id,
            dedupe_key,
            channel,
          }),
        },
      ],
    };
  }
);

mcp.registerTool(
  "list_sent_alerts",
  {
    description:
      "Read back alerts already delivered to the local outbox (reuses src/alerts/outbox.ts's own read logic), optionally filtered by channel, so an agent can verify its own send_alert calls without reading the raw file.",
    inputSchema: {
      channel: z
        .string()
        .optional()
        .describe("Only return alerts delivered to this channel"),
    },
  },
  async ({ channel }) => {
    const lines = readOutboxLines();
    const filtered = channel
      ? lines.filter((line) => line.channel === channel)
      : lines;

    return {
      content: [{ type: "text" as const, text: JSON.stringify(filtered) }],
    };
  }
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await mcp.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
