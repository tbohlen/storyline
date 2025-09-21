import { generate, DateAssignmentResponse } from '../lib/llmService';
import { getDriver } from '../lib/database';
import { EventData } from './eventDetector';
import pino from 'pino';
import { Session, QueryResult } from 'neo4j-driver';

const logger = pino();

export interface DateAssignmentResult {
  eventId: string;
  absoluteDate: string;
  confidence: string;
  sourceText: string;
}

export async function assignDate(eventData: EventData): Promise<DateAssignmentResult | null> {
  logger.info(`Date Assignment started for event ${eventData.id}`);

  // Construct prompt for date detection
  const prompt = `
    You are an expert at identifying absolute dates in historical and fictional texts.
    Analyze the following event and its surrounding context to find any specific dates mentioned.

    Event Quote: "${eventData.quote}"

    Look for any absolute dates in formats like:
    - "April 15, 1188"
    - "15th of April, year 1188"
    - "in the year of our Lord 1188"
    - Any other date formats

    If you find a date, provide:
    1. The exact date in YYYY-MM-DD format
    2. The confidence level (low, medium, high)
    3. The source text that contains the date

    Respond with JSON format only.
  `;

  try {
    // Call LLM service
    const llmResponse = await generate(prompt, 'DateAssignmentAgent') as DateAssignmentResponse;

    if (llmResponse.dateFound && llmResponse.absoluteDate) {
      // Update Event node with absolute date
      await updateEventWithDate(eventData.id, llmResponse.absoluteDate);

      logger.info('Date assigned to event', {
        eventId: eventData.id,
        date: llmResponse.absoluteDate,
        confidence: llmResponse.confidence
      });

      return {
        eventId: eventData.id,
        absoluteDate: llmResponse.absoluteDate,
        confidence: llmResponse.confidence,
        sourceText: llmResponse.sourceText
      };
    } else {
      logger.info('No absolute date found for event' + " " + JSON.stringify({ eventId: eventData.id }));
      return null;
    }

  } catch (error) {
    logger.error('Error in date assignment:' + " " + JSON.stringify(error));
    throw error;
  }
}

async function updateEventWithDate(eventId: string, absoluteDate: string): Promise<QueryResult> {
  const session: Session = getDriver().session();

  try {
    const query = `
      MATCH (e:Event {id: $eventId})
      SET e.absoluteDate = $absoluteDate,
          e.dateAssignedAt = datetime()
      RETURN e
    `;

    const result = await session.run(query, { eventId, absoluteDate });

    if (result.records.length === 0) {
      throw new Error(`Event with id ${eventId} not found`);
    }

    logger.info('Event updated with absolute date' + " " + JSON.stringify({ eventId, absoluteDate }));
    return result;

  } catch (error) {
    logger.error('Failed to update event with date:' + " " + JSON.stringify(error));
    throw error;
  } finally {
    await session.close();
  }
}