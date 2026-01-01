import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { getEventDetectionTools } from '../tools/event-detection-tools';
import { readTsv } from '../services/fileParser';
import { loggers } from '../utils/logger';

const logger = loggers.eventDetector;
const ANTHROPIC_MODEL = "claude-sonnet-4-5-20250929";

//TODO: Restructure to create one event at a time, directly using databaseTools (but remember to add zod documentation to databaseTools)

/**
 * Event Detection Agent
 * Analyzes text chunks for significant events and creates Event nodes in the database
 */
export class EventDetectorAgent {
  private masterEvents: any[] = [];
  private systemPrompt: string = '';

  constructor(private novelName: string) {}

  /**
   * Initializes the agent with the master event spreadsheet
   * @param {string} spreadsheetPath - Path to the TSV file containing master events
   */
  async initialize(spreadsheetPath: string): Promise<void> {
    try {
      logger.info({ spreadsheetPath, novelName: this.novelName }, 'Initializing Event Detector Agent');

      // Load master events from spreadsheet
      this.masterEvents = await readTsv(spreadsheetPath);

      // Build system prompt with event types context
      this.systemPrompt = this.buildSystemPrompt();

      logger.info({ masterEventCount: this.masterEvents.length }, 'Event Detector Agent initialized');

    } catch (error) {
      logger.error({ error }, 'Failed to initialize Event Detector Agent');
      throw new Error(`Failed to initialize Event Detector Agent: ${error}`);
    }
  }

  /**
   * Builds the system prompt with master event context
   * @returns {string} The system prompt
   */
  private buildSystemPrompt(): string {
    const eventsList = this.masterEvents
      .map((event) => `- ${event.id}: ${event.description} (${event.category})`)
      .join("\n");

    return `You are an Event Detection Agent analyzing novel text to identify significant events. Each message to you will be a chunk of text from the novel. There will be NO additional instructions provided in the message. Everything you receive is directly from the novel.

Your task is to:
1. Analyze the provided text chunk for events that match or relate to the master event types
2. Extract the exact quote describing each event
3. Provide additional context and description
4. Identify character positions within the chunk
5. Match to master spreadsheet events when possible
6. Extract any hard dates found in the text

MASTER EVENT TYPES:
${eventsList}

IMPORTANT GUIDELINES:
- Only identify events that are significant to the story timeline
- Events should be specific actions, discoveries, arrivals, confrontations, etc.
- Ignore minor details unless they relate to the master event types
- For character positions, count from the start of the provided text chunk (starting at 0)
- If you find multiple events in a chunk, report all of them using the report_events tool
- Be precise with quote extraction - use the exact text from the novel
- If no significant events are found, respond with a message stating no events were detected

TOOL USAGE:
- You have access to a report_events tool
- You MUST use this tool to report any events you find
- Include all detected events in a single tool call
- Do NOT call the tool if no significant events are found. Instead, respond with "No events found"`;
  }

  /**
   * Analyzes a text chunk for events using AI with tool calling
   * @param {string} textChunk - The text to analyze
   * @param {number} globalStartPosition - Starting position of this chunk in the full novel
   * @returns {Promise<string[]>} Array of created event IDs, or empty array if no events found
   */
  async analyzeTextChunk(textChunk: string, globalStartPosition: number): Promise<string[]> {
    try {
      logger.debug({
        chunkLength: textChunk.length,
        globalStartPosition,
        preview: textChunk.substring(0, 100) + '...'
      }, 'Analyzing text chunk for events');

      // Get the event detection tools with context
      const tools = getEventDetectionTools({
        globalStartPosition,
        novelName: this.novelName
      });

      // Use AI to detect events in the text chunk
      const result = await generateText({
        model: anthropic(ANTHROPIC_MODEL),
        system: this.systemPrompt,
        prompt: textChunk,
        tools,
        toolChoice: 'auto',
        maxSteps: 5
      });

      // Check if the AI called the report_events tool
      const toolCalls = result.steps
        .flatMap(step => step.toolCalls || [])
        .filter(tc => tc.toolName === 'report_events');

      if (toolCalls.length === 0) {
        logger.debug({ globalStartPosition }, 'No events found in text chunk');
        return [];
      }

      // Extract event IDs from tool results
      const createdEventIds: string[] = [];
      for (const toolCall of toolCalls) {
        const toolResult = result.steps
          .find(step => step.toolCalls?.some(tc => tc.toolCallId === toolCall.toolCallId))
          ?.toolResults?.find(tr => tr.toolCallId === toolCall.toolCallId);

        if (toolResult?.result && typeof toolResult.result === 'object') {
          const resultObj = toolResult.result as { createdEventIds?: string[] };
          if (resultObj.createdEventIds) {
            createdEventIds.push(...resultObj.createdEventIds);
          }
        }
      }

      logger.info({
        eventCount: createdEventIds.length,
        globalStartPosition
      }, 'Events detected and created in text chunk');

      return createdEventIds;

    } catch (error) {
      logger.error({
        chunkLength: textChunk.length,
        globalStartPosition,
        error
      }, 'Failed to analyze text chunk');
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
  async simpleAnalysis(textChunk: string, globalStartPosition: number): Promise<string> {
    const eventIds = await this.analyzeTextChunk(textChunk, globalStartPosition);

    if (eventIds.length === 0) {
      return "no event found";
    }

    return `Found ${eventIds.length} event(s). Created event IDs: ${eventIds.join(', ')}`;
  }

  /**
   * Gets the current master events loaded in the agent
   * @returns {any[]} Array of master events
   */
  getMasterEvents(): any[] {
    return [...this.masterEvents];
  }

  /**
   * Gets the novel name this agent is processing
   * @returns {string} Novel name
   */
  getNovelName(): string {
    return this.novelName;
  }
}