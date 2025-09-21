import { readDocx } from './fileParser';
import { chunkText } from '../utils/textChunker';
import { detectEvent, EventData } from '../agents/eventDetector';
import { assignDate, DateAssignmentResult } from '../agents/dateAssigner';
import { assignRelationships, RelationshipData } from '../agents/relationshipAssigner';
import { testConnection } from './database';
import pino from 'pino';
import fs from 'fs';
import path from 'path';

const logger = pino();

export interface ProcessingOptions {
  chunkSize?: number;
  overlapSize?: number;
  maxChunks?: number;
  delayBetweenChunks?: number;
}

export interface ProcessedEvent extends EventData {
  dateAssignment?: DateAssignmentResult;
  relationships: RelationshipData[];
}

export interface ProcessingSummary {
  novelNumber: number;
  totalChunks: number;
  processedChunks: number;
  eventsFound: number;
  processingTime: number;
  averageTimePerChunk: number;
}

export interface ProcessingResult {
  success: boolean;
  summary: ProcessingSummary;
  events?: ProcessedEvent[];
  error?: string;
}

export async function processNovel(
  novelPath: string,
  novelNumber: number = 1,
  options: ProcessingOptions = {}
): Promise<ProcessingResult> {
  const startTime = Date.now();
  logger.info('Starting novel processing', {
    novelPath,
    novelNumber,
    options
  });

  try {
    // Test database connection first
    try {
      await testConnection();
      logger.info('Database connection verified');
    } catch (dbError) {
      logger.warn('Database connection failed - continuing with processing but events will not be saved');
    }

    // Step 1: Read the novel file
    logger.info('Reading novel file...');
    let novelText: string;
    const fileExtension = path.extname(novelPath).toLowerCase();

    if (fileExtension === '.docx') {
      novelText = await readDocx(novelPath);
    } else {
      // For demo purposes, read plain text files
      novelText = fs.readFileSync(novelPath, 'utf8');
    }
    logger.info('Novel file read successfully', {
      textLength: novelText.length,
      wordCount: novelText.split(/\s+/).length
    });

    // Step 2: Chunk the text
    const chunkSize = options.chunkSize || 2000;
    const overlapSize = options.overlapSize || 200;

    logger.info(`Chunking text: ${chunkSize} size, ${overlapSize} overlap`);
    const chunks = chunkText(novelText, chunkSize, overlapSize);
    logger.info(`Text chunked successfully: ${chunks.length} chunks`);

    // Step 3: Process each chunk through the agent workflow
    const processedEvents: ProcessedEvent[] = [];
    const maxChunks = options.maxChunks || chunks.length; // Allow limiting for testing

    for (let i = 0; i < Math.min(maxChunks, chunks.length); i++) {
      const chunkNumber = i + 1;
      logger.info(`Processing chunk ${chunkNumber}/${Math.min(maxChunks, chunks.length)}`);

      try {
        // Agent 1: Event Detection
        const eventData = await detectEvent(chunks[i], novelNumber, chunkNumber);

        if (eventData) {
          logger.info(`Event detected, proceeding with analysis: ${eventData.id}`);

          // Agent 2: Date Assignment
          const dateResult = await assignDate(eventData);
          if (dateResult) {
            logger.info('Date assigned to event', {
              eventId: eventData.id,
              date: dateResult.absoluteDate
            });
          }

          // Agent 3: Relationship Assignment
          const relationships = await assignRelationships(eventData);
          logger.info('Relationships processed', {
            eventId: eventData.id,
            relationshipCount: relationships.length
          });

          // Store complete event data
          processedEvents.push({
            ...eventData,
            dateAssignment: dateResult || undefined,
            relationships
          });
        }

      } catch (chunkError) {
        logger.info(`Error processing chunk ${chunkNumber}: ${chunkError}`);
        // Continue with next chunk instead of failing entirely
      }

      // Add small delay between chunks to prevent overwhelming the system
      if (options.delayBetweenChunks) {
        await new Promise(resolve => setTimeout(resolve, options.delayBetweenChunks));
      }
    }

    const duration = Date.now() - startTime;
    const summary: ProcessingSummary = {
      novelNumber,
      totalChunks: chunks.length,
      processedChunks: Math.min(maxChunks, chunks.length),
      eventsFound: processedEvents.length,
      processingTime: duration,
      averageTimePerChunk: duration / Math.min(maxChunks, chunks.length)
    };

    logger.info(`Novel processing completed: ${summary.eventsFound} events found in ${summary.processingTime}ms`);
    return {
      success: true,
      summary,
      events: processedEvents
    };

  } catch (error) {
    logger.error(`Novel processing failed: ${error}`);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
      summary: {
        novelNumber,
        totalChunks: 0,
        processedChunks: 0,
        eventsFound: 0,
        processingTime: Date.now() - startTime,
        averageTimePerChunk: 0
      }
    };
  }
}

export interface SpreadsheetProcessingResult {
  success: boolean;
  message: string;
  eventsProcessed: number;
}

export async function processSpreadsheetEvents(spreadsheetPath: string): Promise<SpreadsheetProcessingResult> {
  logger.info(`Processing spreadsheet events (placeholder): ${spreadsheetPath}`);

  // This would read the events spreadsheet and process them
  // For now, just return a placeholder response
  return {
    success: true,
    message: 'Spreadsheet processing not implemented yet',
    eventsProcessed: 0
  };
}