import Anthropic from "@anthropic-ai/sdk";

type MessageInput = Anthropic.Message | string | Anthropic.ContentBlockParam[];

export interface ChatOptions {
  messages: Anthropic.MessageParam[];
  system?: string;
  temperature?: number;
  stopSequences?: string[];
  tools?: Anthropic.Tool[];
  thinking?: boolean;
  thinkingBudget?: number;
}

function contentFrom(message: MessageInput): Anthropic.MessageParam["content"] {
  if (typeof message === "string") {
    return message;
  }
  if (Array.isArray(message)) {
    return message;
  }
  // Anthropic.Message — reuse its content blocks as request params.
  return message.content as unknown as Anthropic.ContentBlockParam[];
}

export class Claude {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(model: string) {
    this.client = new Anthropic();
    this.model = model;
  }

  addUserMessage(
    messages: Anthropic.MessageParam[],
    message: MessageInput
  ): void {
    messages.push({ role: "user", content: contentFrom(message) });
  }

  addAssistantMessage(
    messages: Anthropic.MessageParam[],
    message: MessageInput
  ): void {
    messages.push({ role: "assistant", content: contentFrom(message) });
  }

  textFromMessage(message: Anthropic.Message): string {
    return message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");
  }

  async chat({
    messages,
    system,
    temperature = 1.0,
    stopSequences = [],
    tools,
    thinking = false,
    thinkingBudget = 1024,
  }: ChatOptions): Promise<Anthropic.Message> {
    const params: Anthropic.MessageCreateParamsNonStreaming = {
      model: this.model,
      max_tokens: 8000,
      messages,
      temperature,
      stop_sequences: stopSequences,
    };

    if (thinking) {
      params.thinking = {
        type: "enabled",
        budget_tokens: thinkingBudget,
      };
    }
    if (tools) {
      params.tools = tools;
    }
    if (system) {
      params.system = system;
    }

    return this.client.messages.create(params);
  }
}
