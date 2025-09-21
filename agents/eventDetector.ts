import { generate, EventDetectionResponse } from '../lib/llmService';
import { getDriver } from '../lib/database';
import pino from 'pino';
import { Session, QueryResult } from 'neo4j-driver';

const logger = pino();

export interface EventData {
  id: string;
  novelNumber: number;
  quote: string;
  charRangeStart: number;
  charRangeEnd: number;
  chunkNumber: number;
  eventType: string;
  significance: string;
}

export async function detectEvent(
  chunkText: string,
  novelNumber: number,
  chunkNumber: number
): Promise<EventData | null> {
  logger.info(`Event Detection started` + " " + JSON.stringify({ novelNumber, chunkNumber, textLength: chunkText.length }));

  // Construct detailed prompt for event detection
  const prompt = `
    You are an expert at identifying significant events in novels. Analyze the following text chunk and identify any major events, discoveries, conflicts, or plot developments.

    Text to analyze:
    "${chunkText}"

    Please identify if there is a significant event in this text. If found, provide:
    1. A direct quote of the key sentence describing the event
    2. The character positions where this quote appears in the text
    3. The type of event (discovery, conflict, dialogue, action, etc.)
    4. The significance level (low, medium, high)

    Respond with JSON format only.
  `;

  try {
    // Call LLM service
    const llmResponse = await generate(prompt, 'EventDetectionAgent') as EventDetectionResponse;

    if (llmResponse.eventFound) {
      // Create Event node in Neo4j
      const eventData: EventData = {
        id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        novelNumber,
        quote: llmResponse.quote,
        charRangeStart: llmResponse.charRangeStart,
        charRangeEnd: llmResponse.charRangeEnd,
        chunkNumber,
        eventType: llmResponse.eventType || 'unknown',
        significance: llmResponse.significance || 'medium'
      };

      await createEventNode(eventData);
      logger.info('Event created successfully' + " " + JSON.stringify({ eventId: eventData.id }));

      return eventData;
    } else {
      logger.info('No significant event found in chunk' + " " + JSON.stringify({ novelNumber, chunkNumber }));
      return null;
    }

  } catch (error) {
    logger.error('Error in event detection:' + " " + JSON.stringify(error));
    throw error;
  }
}

async function createEventNode(eventData: EventData): Promise<QueryResult> {
  const session: Session = getDriver().session();

  try {
    const query = `
      CREATE (e:Event {
        id: $id,
        novelNumber: $novelNumber,
        quote: $quote,
        charRangeStart: $charRangeStart,
        charRangeEnd: $charRangeEnd,
        chunkNumber: $chunkNumber,
        eventType: $eventType,
        significance: $significance,
        createdAt: datetime()
      })
      RETURN e
    `;

    const result = await session.run(query, eventData);
    logger.info('Event node created in Neo4j' + " " + JSON.stringify({ eventId: eventData.id }));
    return result;

  } catch (error) {
    logger.error('Failed to create event node:' + " " + JSON.stringify(error));
    throw error;
  } finally {
    await session.close();
  }
}