/**
 * Individual AI SDK tools for event detection and relationship creation
 * These tools are used by the event detector agent to interact with the database
 */

import { tool } from 'ai';
import { z } from 'zod';
import {
  createEventNode,
  createRelationship,
  findExistingEvent,
  updateEventNode,
  getAllEvents,
} from '../db/events';
import { loggers } from '../utils/logger';
import truncate from '../utils/truncate';

const logger = loggers.database;

const baseFields = {
  quote: z.string()
    .min(1)
    .describe('The exact text quote from the novel that describes the event. Must be verbatim from the source text.'),

  description: z.string()
    .min(5)
    .max(50)
    .describe('A very succinct, natural language description of the event that allows the reader to quickly identify which event this is without reading the context or quote. This will be used as an annotation on a graph visualization and so should be just a few words long.'),

  charRangeStart: z.number()
    .int()
    .nonnegative()
    .describe('Starting character index of the quote within the provided text chunk. Count from 0 at the beginning of the chunk.'),

  charRangeEnd: z.number()
    .int()
    .positive()
    .describe('Ending character index of the quote within the provided text chunk. Must be greater than charRangeStart.'),

  approximateDate: z.string()
    .optional()
    .describe('Any approximate date mentioned in the text or inferred date (e.g., "circa 1888", "late April 1888"). For example, if only a month is provided in the text, but you know what year is being referred to, include the month and the inferred year. Use ISO format YYYY-MM-DD when possible. Leave undefined if no date is mentioned.'),

  absoluteDate: z.string()
    .optional()
    .describe('Any explicit date mentioned in the text (e.g., "1888-04-12", "April 12, 1888"). Use ISO format YYYY-MM-DD when possible. Leave undefined if no specific date is mentioned.')
};


// Create two versions, one with spreadsheetId and one without
const createEventSchema = z
  .object(baseFields)
  .refine((data) => data.charRangeEnd > data.charRangeStart, {
    message: "charRangeEnd must be greater than charRangeStart",
    path: ["charRangeEnd"],
  });
// TODO: Rename spreadsheetId to masterEventId for clarity
const createEventSchemaWithSpreadsheetId = z
  .object({
    ...baseFields,
    spreadsheetId: z
      .string()
      .optional()
      .describe(
        "ID from the master event spreadsheet if this event matches a known event type. Leave undefined if no clear match exists."
      ),
  })
  .refine((data) => data.charRangeEnd > data.charRangeStart, {
    message: "charRangeEnd must be greater than charRangeStart",
    path: ["charRangeEnd"],
  });

// Create TypeScript type from schema
type CreateEventParams = z.infer<
  typeof createEventSchemaWithSpreadsheetId
>;

/**
 * Context passed to all event tools
 * Provides access to shared state and functions during event detection
 */
export interface EventToolContext {
  /** Starting position of the current chunk in the full novel */
  globalStartPosition: number;
  /** Name of the novel being processed */
  novelName: string;
  /** Function to emit messages to SSE stream */
  emitMessage: (
    type: string,
    agent: string,
    message: string,
    data?: Record<string, unknown>
  ) => void;
  /** Whether master events spreadsheet is enabled */
  masterEventsEnabled: boolean;
  /** Master events data from spreadsheet (if enabled) */
  masterEvents?: Record<string, string>[];
}

/**
 * Creates the create_event tool
 * Allows the agent to create a new event node in the database
 */
function createEventTool(context: EventToolContext) {
  return tool({
    description: `Create a new event node in the story timeline. Use this when you identify a significant plot point, action, or occurrence in the text.

Events should be:
- Concrete actions or occurrences (not thoughts or descriptions)
- Significant to the story timeline
- Backed by a direct quote from the text

Do NOT create events for:
- Minor details or background information
- Character thoughts or internal monologue (unless they result in action)
- Scene setting or descriptions`,

    // by conditionally using the WithSpreadsheetId schema, we can instruct the model provide or not provide this value
    inputSchema: context.masterEventsEnabled
      ? createEventSchemaWithSpreadsheetId
      : createEventSchema,

    execute: async (params: CreateEventParams) => {
      // Emit tool call message
      context.emitMessage("tool_call", "event-detector", "Creating event", {
        tool: "create_event",
        quote: truncate(params.quote, 50),
        charRange: `${params.charRangeStart}-${params.charRangeEnd}`,
      });

      try {
        // Validate character ranges
        if (
          params.charRangeStart < 0 ||
          params.charRangeEnd < params.charRangeStart
        ) {
          throw new Error(
            `Invalid character range: ${params.charRangeStart}-${params.charRangeEnd}`
          );
        }

        // Convert chunk-relative positions to global positions
        const globalCharStart =
          context.globalStartPosition + params.charRangeStart;
        const globalCharEnd = context.globalStartPosition + params.charRangeEnd;

        logger.debug(
          {
            chunkRelative: `${params.charRangeStart}-${params.charRangeEnd}`,
            global: `${globalCharStart}-${globalCharEnd}`,
          },
          "Converting character positions"
        );

        // Create event in database
        // Note: spreadsheetId may be undefined if master events are disabled
        const eventId = await createEventNode({
          quote: params.quote,
          description: params.description,
          charRangeStart: globalCharStart,
          charRangeEnd: globalCharEnd,
          novelName: context.novelName,
          spreadsheetId: params.spreadsheetId,
          approximateDate: params.approximateDate,
          absoluteDate: params.absoluteDate,
        });

        // Emit success message
        context.emitMessage("tool_result", "event-detector", "Event created", {
          tool: "create_event",
          eventId,
          quote:
            params.quote.substring(0, 50) +
            (params.quote.length > 50 ? "..." : ""),
        });

        return {
          success: true,
          eventId,
          message: `Event created successfully with ID: ${eventId}`,
        };
      } catch (error) {
        logger.error({ error, params }, "Failed to create event");
        context.emitMessage(
          "error",
          "event-detector",
          "Failed to create event",
          {
            tool: "create_event",
            error: String(error),
          }
        );
        throw error;
      }
    },
  });
}

/**
 * Creates the create_relationship tool
 * Allows the agent to establish temporal relationships between events
 */
function createRelationshipTool(context: EventToolContext) {
  return tool({
    description: `Create a temporal relationship between two events. Use this when you can determine the temporal ordering between events.

Relationship types:
- BEFORE: fromEvent happens before toEvent
- AFTER: fromEvent happens after toEvent
- CONCURRENT: Events happen at the same time

Guidelines:
- You can create relationships between events you just created or events you find
- The temporal relationship should be clear from the text
- You need source text that indicates the relationship
- Consider both explicit temporal markers ("the next day", "meanwhile") and implicit narrative flow`,

    inputSchema: z.object({
      fromEventId: z.string().describe('ID of the source event'),
      toEventId: z.string().describe('ID of the target event'),
      relationshipType: z.enum(['BEFORE', 'AFTER', 'CONCURRENT']).describe('Type of temporal relationship'),
      sourceText: z.string().describe('Text snippet that indicates this relationship'),
    }),

    execute: async (params) => {
      context.emitMessage('tool_call', 'event-detector', 'Creating relationship', {
        tool: 'create_relationship',
        type: params.relationshipType,
        fromId: params.fromEventId.substring(0, 8),
        toId: params.toEventId.substring(0, 8),
      });

      try {
        await createRelationship(
          params.fromEventId,
          params.toEventId,
          params.relationshipType,
          params.sourceText
        );

        context.emitMessage('tool_result', 'event-detector', 'Relationship created', {
          tool: 'create_relationship',
          from: params.fromEventId.substring(0, 8),
          to: params.toEventId.substring(0, 8),
          type: params.relationshipType,
        });

        return {
          success: true,
          message: `Created ${params.relationshipType} relationship from ${params.fromEventId} to ${params.toEventId}`,
        };
      } catch (error) {
        logger.error({ error, params }, 'Failed to create relationship');
        context.emitMessage('error', 'event-detector', 'Failed to create relationship', {
          tool: 'create_relationship',
          error: String(error),
        });
        throw error;
      }
    },
  });
}

/**
 * Creates the find_event tool
 * Allows the agent to search for existing events in the database
 */
function findEventTool(context: EventToolContext) {
  return tool({
    description: `Search for an existing event in the database. Use this to:
- Check if an event already exists before creating it
- Find events created in previous chunks to establish relationships with current events
- Look up event details by character position or quote

Provide at least one search criterion (quote, charRangeStart, or charRangeEnd).`,

    inputSchema: z.object({
      quote: z.string().optional().describe('Exact quote to search for'),
      charRangeStart: z.number().optional().describe('Global character range start position'),
      charRangeEnd: z.number().optional().describe('Global character range end position'),
    }),

    execute: async (params) => {
      context.emitMessage('tool_call', 'event-detector', 'Finding event', {
        tool: 'find_event',
        hasQuote: !!params.quote,
        hasCharRange: !!(params.charRangeStart || params.charRangeEnd),
      });

      try {
        // Note: charRangeStart/End are already global positions when searching
        const event = await findExistingEvent({
          quote: params.quote,
          novelName: context.novelName,
          charRangeStart: params.charRangeStart,
          charRangeEnd: params.charRangeEnd,
        });

        if (event) {
          context.emitMessage('tool_result', 'event-detector', 'Event found', {
            tool: 'find_event',
            eventId: event.id,
            description: event.description.substring(0, 50) + (event.description.length > 50 ? '...' : ''),
          });

          return {
            found: true,
            event: {
              id: event.id,
              quote: event.quote,
              description: event.description,
              charRangeStart: event.charRangeStart,
              charRangeEnd: event.charRangeEnd,
              approximateDate: event.approximateDate,
              absoluteDate: event.absoluteDate,
            },
          };
        }

        context.emitMessage('tool_result', 'event-detector', 'Event not found', {
          tool: 'find_event',
        });

        return {
          found: false,
          message: 'No matching event found',
        };
      } catch (error) {
        logger.error({ error, params }, 'Failed to find event');
        context.emitMessage('error', 'event-detector', 'Failed to find event', {
          tool: 'find_event',
          error: String(error),
        });
        throw error;
      }
    },
  });
}

/**
 * Creates the update_event tool
 * Allows the agent to modify properties of an existing event
 */
function updateEventTool(context: EventToolContext) {
  return tool({
    description: `Update properties of an existing event. Use this to add dates, improve descriptions, or correct information about an event you've already created or found.`,

    inputSchema: z.object({
      eventId: z.string().describe('ID of the event to update'),
      description: z.string().optional().describe('Updated description'),
      spreadsheetId: z.string().optional().describe('Master event spreadsheet ID'),
      approximateDate: z.string().optional().describe('Approximate or inferred date'),
      absoluteDate: z.string().optional().describe('Explicit hard date (ISO format)'),
    }),

    execute: async (params) => {
      const { eventId, ...updates } = params;

      context.emitMessage('tool_call', 'event-detector', 'Updating event', {
        tool: 'update_event',
        eventId: eventId.substring(0, 8),
        updates: Object.keys(updates),
      });

      try {
        await updateEventNode(eventId, updates);

        context.emitMessage('tool_result', 'event-detector', 'Event updated', {
          tool: 'update_event',
          eventId: eventId.substring(0, 8),
        });

        return {
          success: true,
          message: `Event ${eventId} updated successfully`,
        };
      } catch (error) {
        logger.error({ error, params }, 'Failed to update event');
        context.emitMessage('error', 'event-detector', 'Failed to update event', {
          tool: 'update_event',
          error: String(error),
        });
        throw error;
      }
    },
  });
}

/**
 * Creates the get_recent_events tool
 * Allows the agent to fetch events from earlier in the novel for cross-chunk relationship creation
 */
function getRecentEventsTool(context: EventToolContext) {
  return tool({
    description: `Get recently created events from earlier in the novel (before this chunk). Use this to find events that might be temporally related to events in the current chunk. This helps establish cross-chunk relationships.

For example, if the current text says "the next day after the party" and you created a "party" event in a previous chunk, use this tool to find that earlier party event so you can create a relationship.`,

    inputSchema: z.object({
      limit: z.number().optional().default(10).describe('Maximum number of recent events to return (default: 10, max: 50)'),
    }),

    execute: async (params) => {
      const limit = Math.min(params.limit || 10, 50); // Cap at 50 to avoid overwhelming the context

      context.emitMessage('tool_call', 'event-detector', 'Fetching recent events', {
        tool: 'get_recent_events',
        limit,
      });

      try {
        const allEvents = await getAllEvents(context.novelName);

        // Get events before the current chunk position, ordered by position
        const recentEvents = allEvents
          .filter(e => e.charRangeEnd < context.globalStartPosition)
          .slice(-limit); // Get last N events

        context.emitMessage('tool_result', 'event-detector', `Found ${recentEvents.length} recent events`, {
          tool: 'get_recent_events',
          count: recentEvents.length,
        });

        return {
          success: true,
          events: recentEvents.map(e => ({
            id: e.id,
            quote: e.quote.substring(0, 100) + (e.quote.length > 100 ? '...' : ''),
            description: e.description,
            charRangeStart: e.charRangeStart,
            charRangeEnd: e.charRangeEnd,
            approximateDate: e.approximateDate,
            absoluteDate: e.absoluteDate,
          })),
          count: recentEvents.length,
        };
      } catch (error) {
        logger.error({ error, params }, 'Failed to get recent events');
        context.emitMessage('error', 'event-detector', 'Failed to get recent events', {
          tool: 'get_recent_events',
          error: String(error),
        });
        throw error;
      }
    },
  });
}

/**
 * Creates the find_master_event tool
 * Allows the agent to search the master events spreadsheet for matching event types
 */
function findMasterEventTool(context: EventToolContext) {
  return tool({
    description: `Search the master events spreadsheet for a matching event type. Use this to find the spreadsheetId for an event that matches a known master event category.

This is useful during timeline resolution when you want to categorize events by linking them to master event types.`,

    inputSchema: z.object({
      description: z.string().describe('Event description to search for in master events'),
    }),

    execute: async (params) => {
      context.emitMessage('tool_call', 'timeline-resolver', 'Searching for master event', {
        tool: 'find_master_event',
        description: params.description.substring(0, 50),
      });

      try {
        if (!context.masterEventsEnabled || !context.masterEvents || context.masterEvents.length === 0) {
          context.emitMessage('tool_result', 'timeline-resolver', 'Master events not available', {
            tool: 'find_master_event',
          });
          return {
            found: false,
            message: 'Master events spreadsheet is not enabled or empty',
          };
        }

        // Simple fuzzy matching: find master events that contain keywords from the description
        const descriptionLower = params.description.toLowerCase();
        const keywords = descriptionLower.split(/\s+/).filter(w => w.length > 3); // Words longer than 3 chars

        const matches = context.masterEvents
          .map(masterEvent => {
            const masterDescLower = (masterEvent.description || '').toLowerCase();
            const matchCount = keywords.filter(keyword => masterDescLower.includes(keyword)).length;
            const matchScore = matchCount / Math.max(keywords.length, 1);

            return {
              masterEvent,
              matchScore,
            };
          })
          .filter(m => m.matchScore > 0.3) // At least 30% of keywords match
          .sort((a, b) => b.matchScore - a.matchScore);

        if (matches.length === 0) {
          context.emitMessage('tool_result', 'timeline-resolver', 'No matching master event found', {
            tool: 'find_master_event',
          });
          return {
            found: false,
            message: 'No matching master event found',
          };
        }

        const bestMatch = matches[0];

        context.emitMessage('tool_result', 'timeline-resolver', 'Found master event match', {
          tool: 'find_master_event',
          spreadsheetId: bestMatch.masterEvent.id,
          confidence: bestMatch.matchScore,
        });

        return {
          found: true,
          spreadsheetId: bestMatch.masterEvent.id,
          description: bestMatch.masterEvent.description,
          category: bestMatch.masterEvent.category,
          matchConfidence: bestMatch.matchScore,
          alternativeMatches: matches.slice(1, 3).map(m => ({
            spreadsheetId: m.masterEvent.id,
            description: m.masterEvent.description,
            matchConfidence: m.matchScore,
          })),
        };
      } catch (error) {
        logger.error({ error, params }, 'Failed to find master event');
        context.emitMessage('error', 'timeline-resolver', 'Failed to find master event', {
          tool: 'find_master_event',
          error: String(error),
        });
        throw error;
      }
    },
  });
}

/**
 * Factory function that creates all event tools with the provided context
 *
 * @param context - Event tool context containing shared state and functions
 * @returns Object containing all event tools
 *
 * @example
 * const tools = createEventTools({
 *   globalStartPosition: 1000,
 *   novelName: 'my-novel.docx',
 *   emitMessage: (type, agent, message, data) => { ... },
 *   masterEventsEnabled: true,
 *   masterEvents: [...]
 * });
 *
 * // Use with AI SDK generateText
 * const result = await generateText({
 *   model,
 *   system,
 *   prompt,
 *   tools,
 * });
 */
export function createEventTools(context: EventToolContext) {
  return {
    create_event: createEventTool(context),
    create_relationship: createRelationshipTool(context),
    find_event: findEventTool(context),
    update_event: updateEventTool(context),
    get_recent_events: getRecentEventsTool(context),
    ...(context.masterEventsEnabled && {
      find_master_event: findMasterEventTool(context)
    })
  }; 
}
