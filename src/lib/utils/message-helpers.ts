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
  GetEventsInRangeInput,
  GetEventsInRangeOutput,
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
  get_events_in_range: {
    input: GetEventsInRangeInput;
    output: GetEventsInRangeOutput;
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
 * Emits a status update as a single data-status UIMessageChunk.
 *
 * Uses the AI SDK's official data-* chunk pattern. Without an `id` field,
 * each call appends a new part to message.parts so all status messages
 * accumulate and remain visible in the chat. No start/finish wrappers are
 * needed — those only serve as message-boundary markers for the SDK's
 * internal message state, and adding them here caused the message ID to
 * change on every emit, making React remount the message component and
 * visually "re-post" the entire history.
 *
 * @param emitChunk - Callback that forwards the chunk to the SSE stream
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
  emitChunk({
    type: "data-status",
    data: {
      ...data,
      status,
      text: content,
      agent,
    },
  });
}
