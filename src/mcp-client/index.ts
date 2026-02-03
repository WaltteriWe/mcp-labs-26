import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import fetchData from "../utils/fetchData";
import type {
  Message,
  ToolCall,
  FunctionTool,
  ChatCompletionRequest,
  MCPTool,
  ChatCompletionResponse,
  ToolResult,
} from "../types/LocalTypes";
import { getSystemMessageContent } from "./systemMessage";

if (!process.env.MCP_SERVER_URL) {
  throw new Error("MCP_SERVER_URL environment variable is required");
}

if (!process.env.OPENAI_PROXY_URL) {
  throw new Error("OPENAI_PROXY_URL environment variable is required");
}

export async function callMcpClient(
  prompt: string,
): Promise<{ answer: string; toolCalls: number }> {
  const model = process.env.OPENAI_MODEL || "gpt-4";

  const systemMessage: Message = {
    role: "system",
    content: getSystemMessageContent(),
  };
  const userMessage: Message = {
    role: "user",
    content: prompt,
  };

  const transport = new StreamableHTTPClientTransport(
    new URL(process.env.MCP_SERVER_URL!),
  );

  const client = new Client({
    name: "mcp-client",
    version: "1.0.0",
  });

  try {
    await client.connect(transport);

    // List available tools
    const toolsResponse = await client.listTools();

    // Prepare tools for OpenAI
    const openaiTools: FunctionTool[] = (toolsResponse.tools as MCPTool[]).map(
      (tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        },
      }),
    );

    // Initialize messages and tool calls
    const messages: Message[] = [systemMessage, userMessage];
    const allToolCalls: ToolCall[] = [];
    const maxRounds = 5;
    let round = 0;

    while (round < maxRounds) {
      // Call OpenAI proxy
      const data: ChatCompletionResponse = await fetchData(
        `${process.env.OPENAI_PROXY_URL}/v1/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages,
            tools: openaiTools,
            tool_choice: "auto",
          } as ChatCompletionRequest),
        },
      );

      const assistantMessage = data.choices[0].message;
      messages.push(assistantMessage);

      if (
        assistantMessage.tool_calls &&
        assistantMessage.tool_calls.length > 0
      ) {
        for (const toolCall of assistantMessage.tool_calls) {
          allToolCalls.push(toolCall);

          let args: unknown;
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch {
            // Handle invalid JSON gracefully
            args = {};
          }

          try {
            const result = await client.callTool({
              name: toolCall.function.name,
              arguments: args as Record<string, unknown>,
            });
            const resultString = (result as ToolResult).content
              .map((c) => c.text)
              .join("\n");
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: resultString,
            });
          } catch (e) {
            // Handle tool call errors
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: `Error calling tool: ${(e as Error).message}`,
            });
          }
        }
      } else {
        // No tool calls, conversation is complete
        break;
      }

      round++;
    }

    // The final answer is the last assistant message
    const finalMessage = messages[messages.length - 1];
    const answer =
      finalMessage.role === "assistant" ? finalMessage.content || "" : "";

    return { answer: answer.trim(), toolCalls: allToolCalls.length };
  } finally {
    await transport.close();
  }
}
