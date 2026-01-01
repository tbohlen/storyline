/**
 * Message types and interfaces for SSE (Server-Sent Events) communication
 * between the orchestrator, agents, and the frontend
 */

/**
 * All possible message types emitted by the orchestrator and agents
 */
export type OrchestratorMessageType =
  | 'status'       // High-level status updates from orchestrator
  | 'analyzing'    // Agent is analyzing a chunk
  | 'processing'   // Orchestrator is processing chunks
  | 'step'         // Agent completed a step (includes toolCall count, usage, etc.)
  | 'tool_call'    // Agent is calling a tool (includes tool name and args)
  | 'tool_result'  // Tool returned a result
  | 'thinking'     // AI reasoning/thinking content
  | 'event_found'  // Event was detected (legacy, still emitted by orchestrator)
  | 'result'       // Analysis result summary
  | 'progress'     // Progress update from orchestrator
  | 'success'      // Success message
  | 'completed'    // Processing complete
  | 'error'        // Error occurred
  | 'connection'   // SSE connection established
  | 'ping';        // Keep-alive ping

/**
 * Base message structure sent via SSE
 */
export interface OrchestratorMessage {
  type: OrchestratorMessageType;
  agent: string;              // 'orchestrator', 'event-detector', 'system'
  message: string;            // Human-readable message
  timestamp: string;          // ISO timestamp (added by SSE layer)
  filename: string;           // Novel filename (added by SSE layer)
  data?: Record<string, unknown>; // Additional structured data
}

/**
 * Tool call message - emitted when the AI decides to call a tool
 *
 * Example:
 * {
 *   type: 'tool_call',
 *   agent: 'event-detector',
 *   message: 'Calling create_event',
 *   data: {
 *     toolName: 'create_event',
 *     args: { quote: '...', description: '...', charRangeStart: 0, charRangeEnd: 50 }
 *   }
 * }
 */
export interface ToolCallMessage extends OrchestratorMessage {
  type: 'tool_call';
  data: {
    toolName: string;         // Name of the tool being called
    args: Record<string, any>; // Tool arguments
  };
}

/**
 * Tool result message - emitted when a tool completes execution
 *
 * Example:
 * {
 *   type: 'tool_result',
 *   agent: 'event-detector',
 *   message: 'Event created',
 *   data: {
 *     tool: 'create_event',
 *     eventId: 'abc-123',
 *     success: true
 *   }
 * }
 */
export interface ToolResultMessage extends OrchestratorMessage {
  type: 'tool_result';
  data: {
    tool: string;             // Name of the tool that completed
    eventId?: string;         // For create_event results
    success?: boolean;        // Operation success status
    [key: string]: any;       // Additional tool-specific data
  };
}

/**
 * Thinking message - emitted when the AI outputs reasoning/thinking content
 *
 * Example:
 * {
 *   type: 'thinking',
 *   agent: 'event-detector',
 *   message: 'Agent reasoning',
 *   data: {
 *     content: 'Let me analyze this text chunk...'
 *   }
 * }
 */
export interface ThinkingMessage extends OrchestratorMessage {
  type: 'thinking';
  data: {
    content: string;          // AI reasoning text (may be truncated)
  };
}

/**
 * Step message - emitted when an agent step completes
 *
 * Example:
 * {
 *   type: 'step',
 *   agent: 'event-detector',
 *   message: 'Step completed',
 *   data: {
 *     finishReason: 'stop',
 *     toolCallCount: 2,
 *     toolResultCount: 2,
 *     usage: { promptTokens: 1000, completionTokens: 200, totalTokens: 1200 }
 *   }
 * }
 */
export interface StepMessage extends OrchestratorMessage {
  type: 'step';
  data: {
    finishReason: string;     // Why the step finished ('stop', 'length', 'tool-calls', etc.)
    toolCallCount: number;    // Number of tool calls in this step
    toolResultCount: number;  // Number of tool results
    usage?: {                 // Token usage for this step
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  };
}

/**
 * Error message - emitted when an error occurs
 *
 * Example:
 * {
 *   type: 'error',
 *   agent: 'event-detector',
 *   message: 'Failed to create event',
 *   data: {
 *     tool: 'create_event',
 *     error: 'Database connection failed'
 *   }
 * }
 */
export interface ErrorMessage extends OrchestratorMessage {
  type: 'error';
  data: {
    error: string;            // Error message or description
    tool?: string;            // Tool that caused the error (if applicable)
    [key: string]: any;       // Additional error context
  };
}

/**
 * Progress message - emitted by orchestrator for processing progress
 *
 * Example:
 * {
 *   type: 'progress',
 *   agent: 'orchestrator',
 *   message: 'Processing chunk 5 of 10',
 *   data: {
 *     chunkNumber: 5,
 *     totalChunks: 10,
 *     eventsFound: 12,
 *     percentComplete: 50
 *   }
 * }
 */
export interface ProgressMessage extends OrchestratorMessage {
  type: 'progress';
  data: {
    chunkNumber?: number;
    totalChunks?: number;
    eventsFound?: number;
    percentComplete?: number;
    [key: string]: any;       // Additional progress data
  };
}
