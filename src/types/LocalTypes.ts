type MessageResponse = {
  message: string;
};

type ErrorResponse = MessageResponse & {
  stack?: string;
};

type Message = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};

type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

type FunctionTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

type ChatCompletionRequest = {
  model: string;
  messages: Message[];
  tools?: FunctionTool[];
  tool_choice?: "auto";
};

type MCPTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

type ChatCompletionResponse = {
  choices: {
    message: Message;
  }[];
};

type ToolResult = {
  content: { text: string }[];
};

export type {
  MessageResponse,
  ErrorResponse,
  Message,
  ToolCall,
  FunctionTool,
  ChatCompletionRequest,
  MCPTool,
  ChatCompletionResponse,
  ToolResult,
};
