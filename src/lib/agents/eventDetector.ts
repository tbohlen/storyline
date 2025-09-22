import { anthropic } from '@ai-sdk/anthropic';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import { createEventNode } from '../tools/databaseTools';
import { readTsv } from '../services/fileParser';
import { loggers } from '../utils/logger';

const logger = loggers.eventDetector;

/**
 * Schema for event detection response
 */
const EventDetectionSchema = z.object({
  eventFound: z.boolean(),
  events: z.array(z.object({
    quote: z.string().describe('The exact text quote from the novel that describes the event'),
    description: z.string().describe('A natural language description of the event with additional context'),
    charRangeStart: z.number().describe('Starting character index of the quote in the text chunk'),
    charRangeEnd: z.number().describe('Ending character index of the quote in the text chunk'),
    spreadsheetId: z.string().optional().describe('ID from the master spreadsheet if this matches a known event type'),
    absoluteDate: z.string().optional().describe('Any hard date found in the text (e.g., "1888-04-12")')
  }))
});

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
      logger.info('Initializing Event Detector Agent', { spreadsheetPath, novelName: this.novelName });

      // Load master events from spreadsheet
      this.masterEvents = await readTsv(spreadsheetPath);

      // Build system prompt with event types context
      this.systemPrompt = this.buildSystemPrompt();

      logger.info('Event Detector Agent initialized', {
        masterEventCount: this.masterEvents.length
      });

    } catch (error) {
      logger.error('Failed to initialize Event Detector Agent', { error });
      throw new Error(`Failed to initialize Event Detector Agent: ${error}`);
    }
  }

  /**
   * Builds the system prompt with master event context
   * @returns {string} The system prompt
   */
  private buildSystemPrompt(): string {
    const eventsList = this.masterEvents
      .map(event => `- ${event.id}: ${event.description} (${event.category})`)
      .join('\n');

    return `You are an Event Detection Agent analyzing novel text to identify significant events.

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
- If you find multiple events in a chunk, report all of them
- Be precise with quote extraction - use the exact text from the novel
- If no significant events are found, set eventFound to false with empty events array

RESPONSE FORMAT:
Return a JSON object with:
- eventFound: boolean indicating if any events were detected
- events: array of event objects with quote, description, character positions, etc.`;
  }

  /**
   * Analyzes a text chunk for events
   * @param {string} textChunk - The text to analyze
   * @param {number} globalStartPosition - Starting position of this chunk in the full novel
   * @returns {Promise<string[]>} Array of created event IDs, or empty array if no events found
   */
  async analyzeTextChunk(textChunk: string, globalStartPosition: number): Promise<string[]> {
    try {
      logger.debug('Analyzing text chunk for events', {
        chunkLength: textChunk.length,
        globalStartPosition,
        preview: textChunk.substring(0, 100) + '...'
      });

      // Use AI to detect events in the text chunk
      const result = await generateObject({
        model: anthropic('claude-3-5-sonnet-20241022'),
        system: this.systemPrompt,
        prompt: `Analyze the following text chunk for significant events:

TEXT CHUNK (starting at character ${globalStartPosition}):
"""
${textChunk}
"""

Identify any significant events in this text. Remember that character positions should be relative to the start of this text chunk (starting at 0).`,
        schema: EventDetectionSchema,
      });

      if (!result.object.eventFound || result.object.events.length === 0) {
        logger.debug('No events found in text chunk', { globalStartPosition });
        return [];
      }

      logger.info('Events detected in text chunk', {
        eventCount: result.object.events.length,
        globalStartPosition
      });

      // Create Event nodes for each detected event
      const createdEventIds: string[] = [];

      for (const event of result.object.events) {
        try {
          // Convert chunk-relative positions to global positions
          const globalCharStart = globalStartPosition + event.charRangeStart;
          const globalCharEnd = globalStartPosition + event.charRangeEnd;

          const eventId = await createEventNode({
            quote: event.quote,
            charRangeStart: globalCharStart,
            charRangeEnd: globalCharEnd,
            description: event.description,
            novelName: this.novelName,
            spreadsheetId: event.spreadsheetId,
            absoluteDate: event.absoluteDate
          });

          createdEventIds.push(eventId);

          logger.info('Event created', {
            eventId,
            quote: event.quote.substring(0, 50) + '...',
            globalRange: `${globalCharStart}-${globalCharEnd}`
          });

        } catch (error) {
          logger.error('Failed to create event node', {
            event: event.quote.substring(0, 50) + '...',
            error
          });
          // Continue processing other events even if one fails
        }
      }

      return createdEventIds;

    } catch (error) {
      logger.error('Failed to analyze text chunk', {
        chunkLength: textChunk.length,
        globalStartPosition,
        error
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