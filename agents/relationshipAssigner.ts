import { generate, RelationshipAssignmentResponse } from '../lib/llmService';
import { getDriver } from '../lib/database';
import { EventData } from './eventDetector';
import pino from 'pino';
import { Session, QueryResult } from 'neo4j-driver';

const logger = pino();

export interface RelationshipData {
  sourceEventId: string;
  targetEventId: string;
  type: string;
  sourceText: string;
  confidence: string;
  targetDescription: string;
}

export async function assignRelationships(eventData: EventData): Promise<RelationshipData[]> {
  logger.info(`Relationship Assignment started for event` + " " + JSON.stringify({ eventId: eventData.id }));

  // Construct prompt for relationship detection
  const prompt = `
    You are an expert at identifying temporal relationships between events in stories.
    Analyze the following event and identify any references to other events that happened before, after, or during this event.

    Event Quote: "${eventData.quote}"

    Look for temporal relationships such as:
    - "before the great battle"
    - "after the coronation"
    - "during the feast"
    - "while the king was away"
    - Any other temporal indicators

    For each relationship found, provide:
    1. The type of relationship (BEFORE, AFTER, DURING)
    2. A description of the related event
    3. The source text that implies this relationship
    4. Confidence level (low, medium, high)

    Respond with JSON format containing an array of relationships.
  `;

  try {
    // Call LLM service
    const llmResponse = await generate(prompt, 'RelationshipAssignmentAgent') as RelationshipAssignmentResponse;

    const relationships = llmResponse.relationshipsFound || [];

    if (relationships.length > 0) {
      const createdRelationships: RelationshipData[] = [];

      for (const relationship of relationships) {
        // Create or find the target event and create relationship
        const relationshipData = await createRelationship(
          eventData.id,
          relationship.type,
          relationship.targetEvent,
          relationship.sourceText,
          relationship.confidence
        );

        createdRelationships.push(relationshipData);
      }

      logger.info('Relationships created for event', {
        eventId: eventData.id,
        relationshipCount: createdRelationships.length
      });

      return createdRelationships;
    } else {
      logger.info('No relationships found for event' + " " + JSON.stringify({ eventId: eventData.id }));
      return [];
    }

  } catch (error) {
    logger.error('Error in relationship assignment:' + " " + JSON.stringify(error));
    throw error;
  }
}

async function createRelationship(
  sourceEventId: string,
  relationshipType: string,
  targetEventDescription: string,
  sourceText: string,
  confidence: string
): Promise<RelationshipData> {
  const session: Session = getDriver().session();

  try {
    // First, try to find or create a placeholder target event
    const targetEventId = `placeholder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const query = `
      // Find or create source event
      MATCH (source:Event {id: $sourceEventId})

      // Create placeholder target event
      CREATE (target:Event {
        id: $targetEventId,
        description: $targetEventDescription,
        isPlaceholder: true,
        createdAt: datetime()
      })

      // Create relationship
      CREATE (source)-[r:RELATES_TO {
        type: $relationshipType,
        sourceText: $sourceText,
        confidence: $confidence,
        createdAt: datetime()
      }]->(target)

      RETURN source, r, target
    `;

    const result: QueryResult = await session.run(query, {
      sourceEventId,
      targetEventId,
      targetEventDescription,
      relationshipType,
      sourceText,
      confidence
    });

    const relationship: RelationshipData = {
      sourceEventId,
      targetEventId,
      type: relationshipType,
      sourceText,
      confidence,
      targetDescription: targetEventDescription
    };

    logger.info('Relationship created in Neo4j' + " " + JSON.stringify(relationship));
    return relationship;

  } catch (error) {
    logger.error('Failed to create relationship:' + " " + JSON.stringify(error));
    throw error;
  } finally {
    await session.close();
  }
}