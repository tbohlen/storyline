import { executeQuery } from '../services/database';
import { v4 as uuidv4 } from 'uuid';
import { loggers } from '../utils/logger';

const logger = loggers.database;

/**
 * Interface for Event node properties
 */
export interface EventNode {
  id: string;
  spreadsheetId?: string;
  novelName: string;
  quote: string;
  description: string;
  charRangeStart: number;
  charRangeEnd: number;
  absoluteDate?: string;
}

/**
 * Interface for relationship properties
 */
export interface EventRelationship {
  sourceText: string;
}

/**
 * Creates an Event node in the Neo4j database
 * @param {Object} params - Event parameters
 * @param {string} params.quote - Direct text quote describing the event
 * @param {number} params.charRangeStart - Starting character index in the novel
 * @param {number} params.charRangeEnd - Ending character index in the novel
 * @param {string} params.description - AI-generated description of the event
 * @param {string} params.novelName - Name of the novel file
 * @param {string} [params.spreadsheetId] - Optional ID from events spreadsheet
 * @param {string} [params.absoluteDate] - Optional hard date if found
 * @returns {Promise<string>} The created event ID
 */
export async function createEventNode(params: {
  quote: string;
  charRangeStart: number;
  charRangeEnd: number;
  description: string;
  novelName: string;
  spreadsheetId?: string;
  absoluteDate?: string;
}): Promise<string> {
  const eventId = uuidv4();

  try {
    logger.info('Creating event node', {
      eventId,
      novelName: params.novelName,
      charRange: `${params.charRangeStart}-${params.charRangeEnd}`
    });

    const cypher = `
      CREATE (e:Event {
        id: $id,
        spreadsheetId: $spreadsheetId,
        novelName: $novelName,
        quote: $quote,
        description: $description,
        charRangeStart: $charRangeStart,
        charRangeEnd: $charRangeEnd,
        absoluteDate: $absoluteDate,
        createdAt: datetime()
      })
      RETURN e.id as eventId
    `;

    const result = await executeQuery(cypher, {
      id: eventId,
      spreadsheetId: params.spreadsheetId || null,
      novelName: params.novelName,
      quote: params.quote,
      description: params.description,
      charRangeStart: params.charRangeStart,
      charRangeEnd: params.charRangeEnd,
      absoluteDate: params.absoluteDate || null,
    });

    if (result.records.length === 0) {
      throw new Error('Failed to create event node - no result returned');
    }

    logger.info('Event node created successfully', { eventId });
    return eventId;

  } catch (error) {
    logger.error('Failed to create event node', { eventId, error });
    throw new Error(`Failed to create event node: ${error}`);
  }
}

/**
 * Creates a temporal relationship between two events
 * @param {string} fromEventId - Source event ID
 * @param {string} toEventId - Target event ID
 * @param {string} relationshipType - BEFORE, AFTER, or CONCURRENT
 * @param {string} sourceText - Text snippet that implies this relationship
 * @returns {Promise<void>}
 */
export async function createRelationship(
  fromEventId: string,
  toEventId: string,
  relationshipType: 'BEFORE' | 'AFTER' | 'CONCURRENT',
  sourceText: string
): Promise<void> {
  try {
    logger.info('Creating relationship', {
      fromEventId,
      toEventId,
      relationshipType,
      sourceText: sourceText.substring(0, 100) + '...'
    });

    // Validate relationship type
    const validTypes = ['BEFORE', 'AFTER', 'CONCURRENT'];
    if (!validTypes.includes(relationshipType)) {
      throw new Error(`Invalid relationship type: ${relationshipType}. Must be one of: ${validTypes.join(', ')}`);
    }

    const cypher = `
      MATCH (from:Event {id: $fromEventId})
      MATCH (to:Event {id: $toEventId})
      CREATE (from)-[r:${relationshipType} {
        sourceText: $sourceText,
        createdAt: datetime()
      }]->(to)
      RETURN r
    `;

    const result = await executeQuery(cypher, {
      fromEventId,
      toEventId,
      sourceText,
    });

    if (result.records.length === 0) {
      throw new Error('Failed to create relationship - events may not exist');
    }

    logger.info('Relationship created successfully', {
      fromEventId,
      toEventId,
      relationshipType
    });

  } catch (error) {
    logger.error('Failed to create relationship', {
      fromEventId,
      toEventId,
      relationshipType,
      error
    });
    throw new Error(`Failed to create relationship: ${error}`);
  }
}

/**
 * Finds an existing event by quote or other criteria
 * @param {Object} searchCriteria - Search parameters
 * @param {string} [searchCriteria.quote] - Exact quote to match
 * @param {string} [searchCriteria.novelName] - Novel name to match
 * @param {number} [searchCriteria.charRangeStart] - Character range start
 * @param {number} [searchCriteria.charRangeEnd] - Character range end
 * @returns {Promise<EventNode | null>} The found event or null
 */
export async function findExistingEvent(searchCriteria: {
  quote?: string;
  novelName?: string;
  charRangeStart?: number;
  charRangeEnd?: number;
}): Promise<EventNode | null> {
  try {
    logger.debug('Searching for existing event', searchCriteria);

    const conditions: string[] = [];
    const parameters: Record<string, any> = {};

    if (searchCriteria.quote) {
      conditions.push('e.quote = $quote');
      parameters.quote = searchCriteria.quote;
    }

    if (searchCriteria.novelName) {
      conditions.push('e.novelName = $novelName');
      parameters.novelName = searchCriteria.novelName;
    }

    if (searchCriteria.charRangeStart !== undefined) {
      conditions.push('e.charRangeStart = $charRangeStart');
      parameters.charRangeStart = searchCriteria.charRangeStart;
    }

    if (searchCriteria.charRangeEnd !== undefined) {
      conditions.push('e.charRangeEnd = $charRangeEnd');
      parameters.charRangeEnd = searchCriteria.charRangeEnd;
    }

    if (conditions.length === 0) {
      throw new Error('At least one search criterion must be provided');
    }

    const cypher = `
      MATCH (e:Event)
      WHERE ${conditions.join(' AND ')}
      RETURN e.id as id, e.spreadsheetId as spreadsheetId, e.novelName as novelName,
             e.quote as quote, e.description as description,
             e.charRangeStart as charRangeStart, e.charRangeEnd as charRangeEnd,
             e.absoluteDate as absoluteDate
      LIMIT 1
    `;

    const result = await executeQuery(cypher, parameters);

    if (result.records.length === 0) {
      logger.debug('No existing event found', searchCriteria);
      return null;
    }

    const record = result.records[0];
    const event: EventNode = {
      id: record.get('id'),
      spreadsheetId: record.get('spreadsheetId'),
      novelName: record.get('novelName'),
      quote: record.get('quote'),
      description: record.get('description'),
      charRangeStart: record.get('charRangeStart'),
      charRangeEnd: record.get('charRangeEnd'),
      absoluteDate: record.get('absoluteDate'),
    };

    logger.debug('Found existing event', { eventId: event.id });
    return event;

  } catch (error) {
    logger.error('Failed to find existing event', { searchCriteria, error });
    throw new Error(`Failed to find existing event: ${error}`);
  }
}

/**
 * Updates properties of an existing event
 * @param {string} eventId - ID of the event to update
 * @param {Partial<EventNode>} updates - Properties to update
 * @returns {Promise<void>}
 */
export async function updateEventNode(
  eventId: string,
  updates: Partial<Omit<EventNode, 'id'>>
): Promise<void> {
  try {
    logger.info('Updating event node', { eventId, updates });

    const setParts: string[] = [];
    const parameters: Record<string, any> = { eventId };

    // Build dynamic SET clause
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        setParts.push(`e.${key} = $${key}`);
        parameters[key] = value;
      }
    });

    if (setParts.length === 0) {
      throw new Error('No updates provided');
    }

    const cypher = `
      MATCH (e:Event {id: $eventId})
      SET ${setParts.join(', ')}, e.updatedAt = datetime()
      RETURN e.id as eventId
    `;

    const result = await executeQuery(cypher, parameters);

    if (result.records.length === 0) {
      throw new Error(`Event with ID ${eventId} not found`);
    }

    logger.info('Event node updated successfully', { eventId });

  } catch (error) {
    logger.error('Failed to update event node', { eventId, updates, error });
    throw new Error(`Failed to update event node: ${error}`);
  }
}

/**
 * Gets all events from the database ordered by character position
 * @param {string} [novelName] - Optional filter by novel name
 * @returns {Promise<EventNode[]>} Array of events ordered by charRangeStart
 */
export async function getAllEvents(novelName?: string): Promise<EventNode[]> {
  try {
    logger.debug('Retrieving all events', { novelName });

    let cypher = `
      MATCH (e:Event)
      ${novelName ? 'WHERE e.novelName = $novelName' : ''}
      RETURN e.id as id, e.spreadsheetId as spreadsheetId, e.novelName as novelName,
             e.quote as quote, e.description as description,
             e.charRangeStart as charRangeStart, e.charRangeEnd as charRangeEnd,
             e.absoluteDate as absoluteDate
      ORDER BY e.charRangeStart ASC
    `;

    const parameters = novelName ? { novelName } : {};
    const result = await executeQuery(cypher, parameters);

    const events: EventNode[] = result.records.map(record => ({
      id: record.get('id'),
      spreadsheetId: record.get('spreadsheetId'),
      novelName: record.get('novelName'),
      quote: record.get('quote'),
      description: record.get('description'),
      charRangeStart: record.get('charRangeStart'),
      charRangeEnd: record.get('charRangeEnd'),
      absoluteDate: record.get('absoluteDate'),
    }));

    logger.debug('Retrieved events', { count: events.length, novelName });
    return events;

  } catch (error) {
    logger.error('Failed to retrieve events', { novelName, error });
    throw new Error(`Failed to retrieve events: ${error}`);
  }
}