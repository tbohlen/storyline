import { anthropic } from "@ai-sdk/anthropic";
import { ToolLoopAgent } from "ai";
import { createEventTools, EventToolContext } from "../tools/event-tools";
import { EventNode, getBatchRelationships } from "../tools/databaseTools";
import { loggers } from "../utils/logger";

const logger = loggers.timeline;
const ANTHROPIC_MODEL = "claude-sonnet-4-5-20250929";

/**
 * Timeline Resolver Agent
 * Second-pass agent that analyzes batches of nearby events to establish comprehensive
 * temporal relationships and infer dates from surrounding context
 */
export class TimelineResolverAgent {
  private masterEvents: Record<string, string>[] = [];
  private masterEventsEnabled: boolean = false;
  private systemPrompt: string = "";
  private emitMessage: (
    type: string,
    agent: string,
    message: string,
    data?: Record<string, unknown>
  ) => void;

  constructor(
    private novelName: string,
    emitMessage: (
      type: string,
      agent: string,
      message: string,
      data?: Record<string, unknown>
    ) => void
  ) {
    this.emitMessage = emitMessage;
  }

  /**
   * Initializes the agent with optional master event spreadsheet
   * @param {Record<string, string>[]} masterEvents - Optional master events data
   */
  async initialize(masterEvents?: Record<string, string>[]): Promise<void> {
    try {
      logger.info(
        { novelName: this.novelName },
        "Initializing Timeline Resolver Agent"
      );

      if (masterEvents && masterEvents.length > 0) {
        this.masterEvents = masterEvents;
        this.masterEventsEnabled = true;
        logger.info(
          { masterEventCount: this.masterEvents.length },
          "Master events loaded for timeline resolution"
        );
      } else {
        this.masterEvents = [];
        this.masterEventsEnabled = false;
        logger.info("Master events disabled for timeline resolution");
      }

      this.systemPrompt = this.buildSystemPrompt();

      logger.info("Timeline Resolver Agent initialized");
    } catch (error) {
      logger.error({ error }, "Failed to initialize Timeline Resolver Agent");
      throw new Error(`Failed to initialize Timeline Resolver Agent: ${error}`);
    }
  }

  /**
   * Builds the system prompt for timeline resolution
   * @returns {string} The system prompt
   */
  private buildSystemPrompt(): string {
    let prompt = `You are a Timeline Resolution Agent analyzing events from a novel to establish comprehensive temporal relationships and infer dates.

You will receive:
1. A batch of nearby events (events that occur near each other in the novel text)
2. The surrounding context text from the novel
3. Any existing relationships between these events

Your task is to analyze the context and establish temporal relationships between events.`;

    if (this.masterEventsEnabled && this.masterEvents.length > 0) {
      const eventsList = this.masterEvents
        .map((event) => `- ${event.id}: ${event.description} (${event.category})`)
        .join("\n");

      prompt += `

MASTER EVENT TYPES:
${eventsList}

If an event matches a master event type, use find_master_event to get the spreadsheetId, then use update_event to link it.`;
    }

    prompt += `

CRITICAL GUIDELINES:
- **Document ALL implied orderings, even if contradictory**
- If different parts of the text suggest different temporal orders, create MULTIPLE relationships
- Example: Text might say "after the battle, he rested" (A BEFORE B) but later say "before resting, the battle occurred" (A AFTER B)
- Both relationships are valid and should be created with their supporting sourceText
- Contradictions are EXPECTED and valuable - they reveal inconsistencies in the source material

TEMPORAL MARKERS TO LOOK FOR:
- Explicit: "the next day", "three weeks later", "meanwhile", "simultaneously", "earlier"
- Dates: "April 12, 1888", "late spring", "circa 1920"
- Sequential: "after", "before", "then", "following", "during"
- Flashbacks: "remembered", "recalled", "thought back to"
- Time jumps: "years passed", "the following month"

RELATIONSHIP TYPES:
- BEFORE: First event happens before second event
- AFTER: First event happens after second event
- CONCURRENT: Events happen at the same time

WORKFLOW:
1. Read the context text carefully
2. Review the batch of events provided
3. Look for temporal markers in the text
4. For each pair of events you can relate:
   - Use create_relationship with the supporting text
   - Create ALL relationships you find (even if contradictory)
5. If you can infer dates from the context, use update_event to add them
6. If master events are enabled, use find_master_event and update_event to link events
7. Think through your reasoning step by step

TOOLS AVAILABLE:
- create_relationship: Link two events with temporal relationship (BEFORE, AFTER, or CONCURRENT)
- update_event: Add dates or master event links to an event
- find_master_event: Search for matching master event types

Remember: Your job is to document what the text says, not to resolve contradictions. Multiple orderings are data, not errors.`;

    return prompt;
  }

  /**
   * Analyzes a batch of nearby events with surrounding context to establish relationships
   * @param {EventNode[]} events - Batch of nearby events
   * @param {string} contextText - Surrounding text from the novel
   * @returns {Promise<{ relationshipsCreated: number; datesAdded: number; masterEventsLinked: number }>}
   */
  async analyzeBatch(
    events: EventNode[],
    contextText: string
  ): Promise<{
    relationshipsCreated: number;
    datesAdded: number;
    masterEventsLinked: number;
  }> {
    try {
      logger.debug(
        {
          eventCount: events.length,
          contextLength: contextText.length,
          eventIds: events.map(e => e.id.substring(0, 8)),
        },
        "Analyzing event batch for timeline resolution"
      );

      this.emitMessage(
        "analyzing",
        "timeline-resolver",
        `Analyzing batch of ${events.length} events`,
        {
          eventCount: events.length,
          contextLength: contextText.length,
        }
      );

      // Get existing relationships for these events
      const eventIds = events.map(e => e.id);
      const existingRelationships = await getBatchRelationships(eventIds);

      // Track created events (not used for timeline resolution, but required by tool context)
      const recentEventIds: string[] = [];

      // Create tools with context
      // Note: globalStartPosition is 0 since we're not creating new events from text positions
      const tools = createEventTools({
        globalStartPosition: 0,
        novelName: this.novelName,
        emitMessage: this.emitMessage,
        recentEventIds,
        masterEventsEnabled: this.masterEventsEnabled,
        masterEvents: this.masterEvents,
      });

      // Build the prompt with event details and context
      const eventsList = events
        .map(
          (e) =>
            `Event ID: ${e.id}
Description: ${e.description}
Quote: "${e.quote}"
Position: ${e.charRangeStart}-${e.charRangeEnd}
${e.approximateDate ? `Approximate Date: ${e.approximateDate}` : ''}
${e.absoluteDate ? `Absolute Date: ${e.absoluteDate}` : ''}`
        )
        .join("\n\n");

      const existingRelsList = existingRelationships.length > 0
        ? existingRelationships
            .map(
              (r) =>
                `${r.from.description} ${r.type} ${r.to.description} (Source: "${r.sourceText.substring(0, 100)}...")`
            )
            .join("\n")
        : "No existing relationships";

      const prompt = `EVENTS TO ANALYZE:
${eventsList}

EXISTING RELATIONSHIPS:
${existingRelsList}

SURROUNDING CONTEXT FROM NOVEL:
${contextText}

Analyze this context and establish temporal relationships between the events. Remember to document ALL implied orderings, even if contradictory.`;

      // Use AI to analyze and create relationships
      const agent = new ToolLoopAgent({
        model: anthropic(ANTHROPIC_MODEL),
        instructions: this.systemPrompt,
        tools: {
          create_relationship: tools.create_relationship,
          update_event: tools.update_event,
          find_master_event: tools.find_master_event,
        },
        maxOutputTokens: 20000,
        onStepFinish: ({
          text,
          toolCalls,
          toolResults,
          finishReason,
          usage,
        }) => {
          this.emitMessage("step", "timeline-resolver", "Agent step completed", {
            finishReason,
            toolCallCount: toolCalls?.length || 0,
            toolResultCount: toolResults?.length || 0,
            usage,
          });

          // Emit each tool call
          toolCalls?.forEach((tc) => {
            this.emitMessage(
              "tool_call",
              "timeline-resolver",
              `Calling ${tc.toolName}`,
              {
                toolName: tc.toolName,
                args: 'args' in tc ? tc.args : undefined,
              }
            );
          });

          // Emit AI reasoning if present
          if (text && text.trim()) {
            this.emitMessage(
              "thinking",
              "timeline-resolver",
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
        prompt,
      });

      // Count statistics from tool results
      const relationshipsCreated = result.toolResults.filter(
        (tr) => tr.toolName === "create_relationship" && 'result' in tr && tr.result && typeof tr.result === 'object' && 'success' in tr.result && tr.result.success
      ).length;

      const datesAdded = result.toolResults.filter(
        (tr) =>
          tr.toolName === "update_event" &&
          'result' in tr &&
          tr.result &&
          typeof tr.result === 'object' &&
          'success' in tr.result &&
          tr.result.success
      ).length;

      const masterEventsLinked = result.toolResults.filter(
        (tr) =>
          tr.toolName === "find_master_event" &&
          'result' in tr &&
          tr.result &&
          typeof tr.result === 'object' &&
          'found' in tr.result &&
          tr.result.found
      ).length;

      logger.info(
        {
          eventCount: events.length,
          relationshipsCreated,
          datesAdded,
          masterEventsLinked,
        },
        "Batch analysis complete"
      );

      this.emitMessage(
        "result",
        "timeline-resolver",
        `Batch analysis complete: ${relationshipsCreated} relationships, ${datesAdded} dates, ${masterEventsLinked} master events`,
        {
          relationshipsCreated,
          datesAdded,
          masterEventsLinked,
        }
      );

      return {
        relationshipsCreated,
        datesAdded,
        masterEventsLinked,
      };
    } catch (error) {
      logger.error({ error, eventCount: events.length }, "Failed to analyze batch");
      this.emitMessage(
        "error",
        "timeline-resolver",
        `Failed to analyze batch: ${error}`,
        {
          error: String(error),
        }
      );
      throw new Error(`Failed to analyze batch: ${error}`);
    }
  }
}
