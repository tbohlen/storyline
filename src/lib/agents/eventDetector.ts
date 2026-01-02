import { anthropic } from "@ai-sdk/anthropic";
import { ToolLoopAgent } from "ai";
import { createEventTools } from "../tools/event-tools";
import { readCsv } from "../services/fileParser";
import { loggers } from "../utils/logger";

const logger = loggers.eventDetector;
const ANTHROPIC_MODEL = "claude-sonnet-4-5-20250929";

/**
 * Event Detection Agent
 * Analyzes text chunks for significant events and creates Event nodes in the database
 * Also establishes temporal relationships between events
 */
export class EventDetectorAgent {
  private masterEvents: Record<string, string>[] = [];
  private masterEventsEnabled: boolean = false;
  private systemPrompt: string = "";
  private emitMessage?: (
    type: string,
    agent: string,
    message: string,
    data?: Record<string, unknown>
  ) => void;

  constructor(private novelName: string) {}

  /**
   * Initializes the agent with optional master event spreadsheet
   * @param {string} spreadsheetPath - Optional path to the CSV file containing master events
   */
  async initialize(spreadsheetPath?: string): Promise<void> {
    try {
      logger.info(
        { spreadsheetPath, novelName: this.novelName },
        "Initializing Event Detector Agent"
      );

      // Load master events from spreadsheet if provided
      if (spreadsheetPath) {
        this.masterEvents = await readCsv(spreadsheetPath);
        this.masterEventsEnabled = true;
        logger.info(
          { masterEventCount: this.masterEvents.length },
          "Master events loaded"
        );
      } else {
        this.masterEvents = [];
        this.masterEventsEnabled = false;
        logger.info("Master events disabled");
      }

      // Build system prompt with event types context
      this.systemPrompt = this.buildSystemPrompt();

      logger.info("Event Detector Agent initialized");
    } catch (error) {
      logger.error({ error }, "Failed to initialize Event Detector Agent");
      throw new Error(`Failed to initialize Event Detector Agent: ${error}`);
    }
  }

  /**
   * Set the message emission function
   * This is injected by the orchestrator to enable real-time status updates
   * @param {Function} emitFn - Function to emit messages to SSE stream
   */
  setEmitFunction(
    emitFn: (
      type: string,
      agent: string,
      message: string,
      data?: Record<string, unknown>
    ) => void
  ): void {
    this.emitMessage = emitFn;
  }

  /**
   * Builds the system prompt with optional master event context
   * @returns {string} The system prompt
   */
  private buildSystemPrompt(): string {
    let prompt = `You are an Event Detection Agent analyzing novel text to identify significant events and their temporal relationships.

Each message to you will be a chunk of text from the novel. There will be NO additional instructions provided in the message. Everything you receive is directly from the novel.
`;

    // Only add master events section if enabled
    if (this.masterEventsEnabled && this.masterEvents.length > 0) {
      const eventsList = this.masterEvents
        .map((event) => `- ${event.id}: ${event.description} (${event.category})`)
        .join("\n");

      prompt += `
MASTER EVENT TYPES:
${eventsList}
`;
    }

    prompt += `
YOUR TASK:
1. Identify significant events in the provided text chunk
2. For each event, use create_event tool with:
   - Exact quote from the text
   - Clear description with context
   - Character positions within THIS chunk (0-based, relative to chunk start)`;

    // Only mention spreadsheet ID if master events are enabled
    if (this.masterEventsEnabled) {
      prompt += `
   - Master spreadsheet ID if it matches a known type`;
    }

    prompt += `
   - Any dates found in the text

3. Establish temporal relationships between events:
   - Between events in THIS chunk (if obvious from the text)
   - Between events in this chunk and recent events from earlier chunks
   - Use get_recent_events to find earlier events if you see temporal references
   - Use create_relationship to establish temporal ordering

IMPORTANT GUIDELINES:
- Only identify events that are significant to the story timeline
- Events should be specific actions, discoveries, arrivals, confrontations, etc.`;

    // Only mention master event types if enabled
    if (this.masterEventsEnabled) {
      prompt += `
- Ignore minor details unless they relate to master event types`;
    }

    prompt += `
- Character positions are relative to the start of THIS chunk (starting at 0)
- Look for temporal markers: "the next day", "meanwhile", "earlier", dates, "after", "before"
- If the text references earlier events, use get_recent_events to find them and create relationships
- Create relationships whenever you can determine temporal ordering from the text
- If no significant events are found, simply respond with your reasoning

TOOLS AVAILABLE:
- create_event: Create a new event node
- create_relationship: Link two events with temporal relationship (BEFORE, AFTER, or CONCURRENT)
- find_event: Check if an event already exists
- update_event: Update an existing event's properties
- get_recent_events: Get recent events from earlier in the novel for cross-chunk relationships

WORKFLOW:
1. Read and analyze the text chunk carefully
2. Identify significant events
3. Create events using create_event tool
4. Look for temporal relationships within the chunk
5. If you see references to earlier events (like "the next day after X"), use get_recent_events to find them
6. Create relationships using create_relationship tool
7. Think through your analysis step by step and explain your reasoning`;

    return prompt;
  }

  /**
   * Analyzes a text chunk for events using AI with tool calling
   * Creates events and relationships in a single pass
   * @param {string} textChunk - The text to analyze
   * @param {number} globalStartPosition - Starting position of this chunk in the full novel
   * @returns {Promise<string[]>} Array of created event IDs, or empty array if no events found
   */
  async analyzeTextChunk(
    textChunk: string,
    globalStartPosition: number
  ): Promise<string[]> {
    try {
      logger.debug(
        {
          chunkLength: textChunk.length,
          globalStartPosition,
          preview: textChunk.substring(0, 100) + "...",
        },
        "Analyzing text chunk for events"
      );

      // Emit analyzing message
      this.emitMessage?.(
        "analyzing",
        "event-detector",
        "Starting chunk analysis",
        {
          chunkLength: textChunk.length,
          globalStartPosition,
        }
      );

      // Track created events in this session
      const recentEventIds: string[] = [];

      // Create tools with context including emit function
      const tools = createEventTools({
        globalStartPosition,
        novelName: this.novelName,
        emitMessage: this.emitMessage || (() => {}),
        recentEventIds,
        masterEventsEnabled: this.masterEventsEnabled,
      });

      // Use AI to detect events and relationships in the text chunk
      const agent = new ToolLoopAgent({
        model: anthropic(ANTHROPIC_MODEL),
        instructions: this.systemPrompt,
        tools,
        maxOutputTokens: 20000, // Allow multiple events and relationships per chunk
        onStepFinish: ({
          text,
          toolCalls,
          toolResults,
          finishReason,
          usage,
        }) => {
          // Emit step completion info
          this.emitMessage?.("step", "event-detector", "Agent step completed", {
            finishReason,
            toolCallCount: toolCalls?.length || 0,
            toolResultCount: toolResults?.length || 0,
            usage,
          });

          // Emit each tool call with its arguments
          toolCalls?.forEach((tc) => {
            this.emitMessage?.(
              "tool_call",
              "event-detector",
              `Calling ${tc.toolName}`,
              {
                toolName: tc.toolName,
                args: tc.args,
              }
            );
          });

          // Emit AI reasoning/thinking if present
          if (text && text.trim()) {
            this.emitMessage?.(
              "thinking",
              "event-detector",
              "Agent reasoning",
              {
                content:
                  text.substring(0, 500) + (text.length > 500 ? "..." : ""),
              }
            );
          }
        },
      });

      const result = await agent.generate({
        prompt: textChunk,
      });

      // Extract created event IDs and count relationships from tool results
      const createdEventIds: string[] = [];
      let createdRelationships = 0;

      for (const toolResult of result.toolResults || []) {
        if (
          toolResult.toolName === "create_event" &&
          typeof toolResult.output === "object" &&
          toolResult.output !== null
        ) {
          const resultObj = toolResult.output as { eventId?: string };
          if (resultObj.eventId) {
            createdEventIds.push(resultObj.eventId);
          }
        } else if (
          toolResult.toolName === "create_relationship" &&
          typeof toolResult.output === "object" &&
          toolResult.output !== null
        ) {
          const resultObj = toolResult.output as { success?: boolean };
          if (resultObj.success) {
            createdRelationships++;
          }
        }
      }

      logger.info(
        {
          eventCount: createdEventIds.length,
          relationshipCount: createdRelationships,
          globalStartPosition,
        },
        "Events and relationships detected in text chunk"
      );

      // Emit final result message
      this.emitMessage?.(
        "result",
        "event-detector",
        "Chunk analysis complete",
        {
          eventCount: createdEventIds.length,
          relationshipCount: createdRelationships,
          eventIds: createdEventIds,
        }
      );

      return createdEventIds;
    } catch (error) {
      logger.error(
        {
          chunkLength: textChunk.length,
          globalStartPosition,
          error,
        },
        "Failed to analyze text chunk"
      );

      this.emitMessage?.("error", "event-detector", "Failed to analyze chunk", {
        error: String(error),
      });

      throw new Error(`Failed to analyze text chunk: ${error}`);
    }
  }

  /**
   * Simple text analysis that returns "no event found" or calls createEventNode
   * This is for the basic workflow described in the implementation plan
   * @param {string} textChunk - The text to analyze
   * @param {number} globalStartPosition - Starting position of this chunk in the full novel
   * @returns {Promise<string>} Either "no event found" or information about created events
   */
  async simpleAnalysis(
    textChunk: string,
    globalStartPosition: number
  ): Promise<string> {
    const eventIds = await this.analyzeTextChunk(
      textChunk,
      globalStartPosition
    );

    if (eventIds.length === 0) {
      return "no event found";
    }

    return `Found ${eventIds.length} event(s). Created event IDs: ${eventIds.join(", ")}`;
  }

  /**
   * Gets the current master events loaded in the agent
   * @returns {Record<string, string>[]} Array of master events
   */
  getMasterEvents(): Record<string, string>[] {
    return [...this.masterEvents];
  }

  /**
   * Gets the novel name this agent is processing
   * @returns {string} Novel name
   */
  getNovelName(): string {
    return this.novelName;
  }

  /**
   * Checks if master events spreadsheet is enabled
   * @returns {boolean} True if master events are loaded and enabled
   */
  isMasterEventsEnabled(): boolean {
    return this.masterEventsEnabled;
  }
}
