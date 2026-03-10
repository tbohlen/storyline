import type { UIMessageChunk, UIMessagePart, ToolUIPart } from "ai";
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
 * Tool type definitions for all available tools in the Storyline application.
 * Maps tool names to their input and output types for proper typing in UIMessagePart.
 *
 * Types are imported from event-tools.ts where they are inferred from Zod schemas.
 * NOTE: Do NOT wrap in ToolUIPart - UIMessagePart expects plain object types.
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
 * Data type definitions for custom data parts.
 * NOTE: Do NOT wrap in DataUIPart - UIMessagePart expects plain object types.
 */
type StorylineData = {
  status: {
    status?: string;
    text?: string;
    [key: string]: unknown;
  };
  "graph-refresh": Record<string, never>;
};

export type StorylineMessagePart = UIMessagePart<StorylineData, StorylineTools>;
export type StorylineToolPart = ToolUIPart<StorylineTools>;

/**
 * Emits a status update as three UIMessageChunks (start, data-status, finish)
 * via the provided emitChunk callback.
 *
 * Encapsulates the chunk-triplet protocol so callers don't repeat the for-loop
 * boilerplate on every status emit.
 *
 * @param emitChunk - Callback that forwards each chunk to the SSE stream
 * @param agent - The agent reporting the status
 * @param status - The status type
 * @param content - The status message text
 * @param data - Optional additional data about the status
 */
export function emitStatusMessage(
  emitChunk: (chunk: UIMessageChunk) => void,
  agent: AgentRole,
  status: EventStatusPart["status"],
  content: string,
  data?: Record<string, unknown>,
): void {
  const messageId = crypto.randomUUID();
  emitChunk({ type: "start", messageId });
  emitChunk({
    type: "data-status",
    data: {
      ...data,
      status,
      text: content,
      agent,
    },
  });
  emitChunk({ type: "finish", finishReason: "stop" });
}
