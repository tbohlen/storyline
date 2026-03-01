import type { UIMessage, UIMessagePart } from "ai";
import type {
  CreateEventInput,
  CreateEventOutput,
  CreateRelationshipInput,
  CreateRelationshipOutput,
  FindEventInput,
  FindEventOutput,
  UpdateEventInput,
  UpdateEventOutput,
  GetRecentEventsInput,
  GetRecentEventsOutput,
  FindMasterEventInput,
  FindMasterEventOutput,
} from "../tools/event-tools";

/**
 * Agent role types for our multi-agent orchestrator
 */
export type AgentRole =
  | "orchestrator"
  | "event-detector"
  | "timeline-resolver"
  | "database"
  | "system";

/**
 * Custom message part for event status updates (not in AI SDK)
 */
export type EventStatusPart = {
  type: "event-status";
  status:
    | "analyzing"
    | "processing"
    | "success"
    | "error"
    | "completed"
    | "event_found";
  data?: Record<string, unknown>;
};

/**
 * Tool type definitions for all available tools in the Storyline application
 * Maps tool names to their input and output types for proper typing in UIMessagePart
 *
 * Types are imported from event-tools.ts where they are inferred from Zod schemas
 * NOTE: Do NOT wrap in ToolUIPart - UIMessagePart expects plain object types
 */
type StorylineTools = {
  create_event: {
    input: CreateEventInput;
    output: CreateEventOutput;
  };
  create_relationship: {
    input: CreateRelationshipInput;
    output: CreateRelationshipOutput;
  };
  find_event: {
    input: FindEventInput;
    output: FindEventOutput;
  };
  update_event: {
    input: UpdateEventInput;
    output: UpdateEventOutput;
  };
  get_recent_events: {
    input: GetRecentEventsInput;
    output: GetRecentEventsOutput;
  };
  find_master_event: {
    input: FindMasterEventInput;
    output: FindMasterEventOutput;
  };
};

/**
 * Data type definitions for custom data parts
 * NOTE: Do NOT wrap in DataUIPart - UIMessagePart expects plain object types
 */
type StorylineData = {
  status: {
    status?: string;
    text?: string;
    [key: string]: unknown;
  };
};

export type StorylineMessagePart = UIMessagePart<StorylineData, StorylineTools>;

/**
 * Create a simple text message
 *
 * @param role - The role of the message sender: "system", "agent", or "user"
 * @param agent - The agent sending the message
 * @param content - The text content of the message
 * @returns AI SDK Message with text part
 */
export function createTextMessage(
  role: UIMessage["role"],
  agent: AgentRole,
  content: string,
): UIMessage {
  return {
    id: crypto.randomUUID(),
    role,
    parts: [{ type: "text", text: content }],
    metadata: {
      roleName: agent,
      createdAt: new Date(),
    },
  };
}

/**
 * Create a reasoning/thinking message (displays in collapsible block)
 *
 * @param role - The role of the message sender: "system", "agent", or "user"
 * @param agent - The agent sending the reasoning
 * @param content - Brief description for the message content field
 * @param reasoningText - The actual reasoning text to display
 * @param filename - Optional filename being processed
 * @returns AI SDK Message with reasoning part
 */
export function createReasoningMessage(
  role: UIMessage["role"],
  agent: AgentRole,
  reasoningText: string,
  filename?: string,
): UIMessage {
  return {
    id: crypto.randomUUID(),
    role,
    parts: [
      {
        type: "reasoning",
        text: reasoningText,
      },
    ],
    metadata: { filename, roleName: agent, createdAt: new Date() },
  };
}

/**
 * Create a tool call message (tool invocation in progress)
 *
 * @param role - The role of the message sender: "system", "agent", or "user"
 * @param agent - The agent calling the tool
 * @param toolCallId - Unique ID for this tool invocation
 * @param toolName - Name of the tool being called
 * @param args - Tool arguments
 * @param filename - Optional filename being processed
 * @returns AI SDK Message with tool-invocation part (state: 'call')
 */
export function createToolCallMessage(
  role: UIMessage["role"],
  agent: AgentRole,
  toolCallId: string,
  toolName: string,
  args: Record<string, unknown>,
  filename?: string,
): UIMessage {
  return {
    id: crypto.randomUUID(),
    role,
    parts: [
      {
        type: `tool-${toolName}`,
        toolCallId,
        state: "input-available",
        input: args,
      },
    ],
    metadata: {
      filename,
      roleName: agent,
      createdAt: new Date(),
    },
  };
}

/**
 * Create a tool result message (tool invocation completed)
 *
 * @param role - The role of the message sender: "system", "agent", or "user"
 * @param agent - The agent that called the tool
 * @param toolCallId - Unique ID matching the original tool call
 * @param toolName - Name of the tool that was called
 * @param args - Tool arguments that were used
 * @param result - The result returned by the tool
 * @param filename - Optional filename being processed
 * @returns AI SDK Message with tool-invocation part (state: 'result')
 */
export function createToolResultMessage(
  role: UIMessage["role"],
  agent: AgentRole,
  toolCallId: string,
  toolName: string,
  args: Record<string, unknown>,
  result: unknown,
  filename?: string,
): UIMessage {
  return {
    id: crypto.randomUUID(),
    role,
    parts: [
      {
        type: `tool-${toolName}`,
        toolCallId,
        state: "output-available",
        input: args,
        output: result,
      },
    ],
    metadata: { filename, roleName: agent, createdAt: new Date() },
  };
}

/**
 * Create an event status message (analyzing, processing, success, error, etc.)
 *
 * @param role - The role of the message sender: "system", "agent", or "user"
 * @param agent - The agent reporting the status
 * @param status - The status type
 * @param content - The status message text
 * @param data - Optional additional data about the status
 * @param filename - Optional filename being processed
 * @returns AI SDK Message with event-status part
 */
export function createStatusMessage(
  role: UIMessage["role"],
  agent: AgentRole,
  status: EventStatusPart["status"],
  content: string,
  data?: Record<string, unknown>,
  filename?: string,
): UIMessage {
  return {
    id: crypto.randomUUID(),
    role,
    parts: [
      {
        type: "data-status",
        data: {
          ...data,
          status,
          text: content,
        },
      },
    ],
    metadata: { filename, roleName: agent, createdAt: new Date() },
  };
}
