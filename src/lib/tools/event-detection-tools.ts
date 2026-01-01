import { z } from 'zod';
import { tool } from 'ai';
import { createEventNode } from './databaseTools';
import { loggers } from '../utils/logger';

const logger = loggers.eventDetector;

/**
 * Zod schema for a single detected event
 * Enforces the exact structure that the AI must provide
 */
export const DetectedEventSchema = z.object({
  quote: z.string()
    .min(1)
    .describe('The exact text quote from the novel that describes the event. Must be verbatim from the source text.'),

  description: z.string()
    .min(10)
    .max(200)
    .describe('A clear, natural language description of the event with additional context about what happened, who was involved, and why it matters to the story. This should be shot so that it can function as a caption or annotation.'),

  charRangeStart: z.number()
    .int()
    .nonnegative()
    .describe('Starting character index of the quote within the provided text chunk. Count from 0 at the beginning of the chunk.'),

  charRangeEnd: z.number()
    .int()
    .positive()
    .describe('Ending character index of the quote within the provided text chunk. Must be greater than charRangeStart.'),

  spreadsheetId: z.string()
    .optional()
    .describe('ID from the master event spreadsheet if this event matches a known event type. Leave undefined if no clear match exists.'),
  
  approximateDate: z.string()
    .optional()
    .describe('Any approximate date mentioned in the text or inferred date (e.g., "circa 1888", "late April 1888"). For example, if only a month is provided in the text, but you know what year is being referred to, include the month and the inferred year. Use ISO format YYYY-MM-DD when possible. Leave undefined if no date is mentioned.'),

  absoluteDate: z.string()
    .optional()
    .describe('Any explicit date mentioned in the text (e.g., "1888-04-12", "April 12, 1888"). Use ISO format YYYY-MM-DD when possible. Leave undefined if no specific date is mentioned.')
}).refine(
  (data) => data.charRangeEnd > data.charRangeStart,
  {
    message: "charRangeEnd must be greater than charRangeStart",
    path: ["charRangeEnd"]
  }
);

/**
 * Zod schema for the tool input - array of detected events
 */
export const ReportEventsInputSchema = z.object({
  events: z.array(DetectedEventSchema)
    .min(1)
    .describe('Array of all significant events detected in the text chunk. Each event must include the exact quote, description, character positions, and optional metadata.')
});

/**
 * Type definitions for TypeScript
 */
export type DetectedEvent = z.infer<typeof DetectedEventSchema>;
export type ReportEventsInput = z.infer<typeof ReportEventsInputSchema>;

/**
 * Creates a tool definition for reporting detected events with the given context
 * The AI must call this tool to report any events it finds in the text
 *
 * @param context - Context containing globalStartPosition and novelName
 * @returns Tool definition configured with the provided context
 */
export function createReportEventsTool(context: EventDetectionContext) {
  return tool({
    description: `Call this tool to record an event in the provided text. Events are concrete plot points or occurances. 

Do NOT call this tool if:
- No significant events are found in the text
- The text only contains background description or character thoughts
- Events are too minor or irrelevant to the main storyline

If you find events, you MUST call this tool to report them. Include all events found in a single tool call.`,

    parameters: ReportEventsInputSchema,

    execute: async ({ events }) => {
      logger.info({
        eventCount: events.length,
        globalStartPosition: context.globalStartPosition,
        novelName: context.novelName
      }, 'Processing reported events from AI');

      const createdEventIds: string[] = [];
      const errors: string[] = [];

      for (const event of events) {
        try {
          // Validate character range
          if (event.charRangeEnd <= event.charRangeStart) {
            throw new Error(`Invalid character range: ${event.charRangeStart}-${event.charRangeEnd}`);
          }

          // Convert chunk-relative positions to global positions
          const globalCharStart = context.globalStartPosition + event.charRangeStart;
          const globalCharEnd = context.globalStartPosition + event.charRangeEnd;

          // Create event node in database
          const eventId = await createEventNode({
            quote: event.quote,
            charRangeStart: globalCharStart,
            charRangeEnd: globalCharEnd,
            description: event.description,
            novelName: context.novelName,
            spreadsheetId: event.spreadsheetId,
            approximateDate: event.approximateDate,
            absoluteDate: event.absoluteDate
          });

          createdEventIds.push(eventId);

          logger.info({
            eventId,
            quote: event.quote.substring(0, 50) + '...',
            globalRange: `${globalCharStart}-${globalCharEnd}`,
            spreadsheetId: event.spreadsheetId,
            approximateDate: event.approximateDate,
            absoluteDate: event.absoluteDate
          }, 'Event created successfully');

        } catch (error) {
          const errorMsg = `Failed to create event: ${error}`;
          logger.error({
            event: event.quote.substring(0, 50) + '...',
            error
          }, errorMsg);
          errors.push(errorMsg);
          // Continue processing other events even if one fails
        }
      }

      const result = {
        success: createdEventIds.length > 0,
        createdEventIds,
        eventCount: createdEventIds.length,
        errors: errors.length > 0 ? errors : undefined
      };

      logger.info({
        successCount: createdEventIds.length,
        errorCount: errors.length
      }, 'Finished processing reported events');

      return result;
    }
  });
}

/**
 * Helper function to get tool definitions for use with AI SDK
 * This returns the tools in a format compatible with the Anthropic API
 *
 * @param context - Context containing globalStartPosition and novelName
 * @returns Object with event detection tools
 */
export function getEventDetectionTools(context: EventDetectionContext) {
  return {
    report_events: createReportEventsTool(context)
  };
}

/**
 * Type for tool execution context
 */
export interface EventDetectionContext {
  globalStartPosition: number;
  novelName: string;
}
