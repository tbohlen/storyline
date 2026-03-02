import { NovelReader } from './novelReader';
import { EventDetectorAgent } from '../agents/eventDetector';
import { TimelineResolverAgent } from '../agents/timelineResolver';
import { initializeDatabase } from './database';
import { getAllEvents } from '../db/events';
import { readCsv } from './fileParser';
import { loggers } from '../utils/logger';
import type { UIMessageChunk } from 'ai';
import { createStatusChunks } from '../utils/message-helpers';

const logger = loggers.orchestrator;

// Dynamic import to avoid circular dependency issues
let emitOrchestratorChunk:
  | ((filename: string, chunk: UIMessageChunk) => void)
  | null = null;

const initializeSSE = async () => {
  if (!emitOrchestratorChunk) {
    try {
      const sseModule = await import('../services/sse-emitter');
      emitOrchestratorChunk = sseModule.emitChunk;
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
      }, "Failed to import SSE emitter");
    }
  }
};

/**
 * Configuration for the orchestrator
 */
export interface OrchestratorConfig {
  chunkSize: number;           // Size of text chunks to process
  overlapSize: number;         // Overlap between chunks to avoid cutting events
  maxRetries: number;          // Max retries for failed operations
  eventDistance: number;       // Distance for relationship detection (not used yet)
  maxEventCount: number;       // Max events per relationship group (not used yet)
  batchRadius: number;         // Group events within this range for timeline resolution
  contextMargin: number;       // Extra context around batches for timeline resolution
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: OrchestratorConfig = {
  chunkSize: 2000,
  overlapSize: 400,
  maxRetries: 3,
  eventDistance: 5000,
  maxEventCount: 10,
  batchRadius: 2500,
  contextMargin: 1000
};

/**
 * Statistics for processing
 */
export interface ProcessingStats {
  totalCharacters: number;
  chunksProcessed: number;
  eventsFound: number;
  processing: boolean;
  progress: number;
  currentPosition: number;
  startTime?: Date;
  endTime?: Date;
  errors: string[];
}

/**
 * Main Orchestrator Service.
 * Manages the complete workflow of loading novels, chunking text, and coordinating agents.
 */
export class Orchestrator {
  private novelReader: NovelReader;
  private eventDetector: EventDetectorAgent;
  private config: OrchestratorConfig;
  private stats: ProcessingStats;
  private filename: string;

  /**
   * Creates a new Orchestrator instance.
   * @param {string} novelPath - Path to the novel file
   * @param {string} spreadsheetPath - Optional path to the master events spreadsheet
   * @param {Partial<OrchestratorConfig>} config - Optional configuration overrides
   */
  constructor(
    private novelPath: string,
    private spreadsheetPath: string | undefined,
    config: Partial<OrchestratorConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize services
    this.novelReader = new NovelReader(novelPath);
    this.eventDetector = new EventDetectorAgent(
      this.novelReader.getFilename(),
      this.emitChunk.bind(this)
    );
    this.filename = this.novelReader.getFilename();

    // Initialize stats
    this.stats = {
      totalCharacters: 0,
      chunksProcessed: 0,
      eventsFound: 0,
      processing: false,
      progress: 0,
      currentPosition: 0,
      errors: []
    };

    logger.info(`Orchestrator created - novelPath: ${novelPath}, spreadsheetPath: ${spreadsheetPath}, config: ${JSON.stringify(this.config)}`);

    // Initialize SSE
    initializeSSE();
  }

  /**
   * Emits a UIMessageChunk to the SSE stream.
   * @param {UIMessageChunk} chunk - The chunk to emit
   */
  private emitChunk(chunk: UIMessageChunk): void {
    if (emitOrchestratorChunk) {
      emitOrchestratorChunk(this.filename, chunk);
    } else {
      console.log("ERROR!! No emitOrchestratorChunk function available");
    }
  }

  /**
   * Initializes all services and prepares for processing.
   * @returns {Promise<void>}
   */
  async initialize(): Promise<void> {
    try {
      for (const c of createStatusChunks('orchestrator', 'analyzing', 'Initializing AI...')) {
        this.emitChunk(c);
      }
      logger.info("Initializing orchestrator services");

      // Initialize database schema
      await initializeDatabase();
      logger.info("Database initialized");

      // Load the novel
      await this.novelReader.loadNovel();
      this.stats.totalCharacters = this.novelReader.getContentLength();
      logger.info(
        `Novel loaded - filename: ${this.novelReader.getFilename()}, totalCharacters: ${this.stats.totalCharacters}`
      );

      // Initialize event detector (with or without master events)
      if (this.spreadsheetPath) {
        await this.eventDetector.initialize(this.spreadsheetPath);
        logger.info(
          { spreadsheetPath: this.spreadsheetPath },
          "Event detector initialized with master events"
        );
      } else {
        await this.eventDetector.initialize();
        logger.info("Event detector initialized without master events");
      }

      for (const c of createStatusChunks('orchestrator', 'success', 'AI initialization complete', {
        totalCharacters: this.stats.totalCharacters,
        chunkSize: this.config.chunkSize,
        overlapSize: this.config.overlapSize,
      })) {
        this.emitChunk(c);
      }
      logger.info("Orchestrator initialization complete");
    } catch (error) {
      const errorMessage = `Initialization failed: ${error}`;
      for (const c of createStatusChunks('orchestrator', 'error', errorMessage, { error: String(error) })) {
        this.emitChunk(c);
      }
      logger.error(`Failed to initialize orchestrator: ${error}`);
      this.stats.errors.push(errorMessage);
      throw new Error(`Orchestrator initialization failed: ${error}`);
    }
  }

  /**
   * Processes the entire novel for event detection.
   * @returns {Promise<ProcessingStats>} Final processing statistics
   */
  async processNovel(): Promise<ProcessingStats> {
    if (this.stats.processing) {
      throw new Error('Processing is already in progress');
    }

    try {
      this.stats.processing = true;
      this.stats.startTime = new Date();
      this.stats.chunksProcessed = 0;
      this.stats.eventsFound = 0;
      this.stats.errors = [];

      for (const c of createStatusChunks('orchestrator', 'analyzing', `Starting novel analysis - ${this.stats.totalCharacters} characters`, {
        totalCharacters: this.stats.totalCharacters,
        chunkSize: this.config.chunkSize,
        overlapSize: this.config.overlapSize,
      })) {
        this.emitChunk(c);
      }
      logger.info(
        `Starting novel processing - totalCharacters: ${this.stats.totalCharacters}, chunkSize: ${this.config.chunkSize}, overlapSize: ${this.config.overlapSize}`
      );

      // Reset reader position
      this.novelReader.setPosition(0);

      while (!this.novelReader.isAtEnd()) {
        try {
          await this.processNextChunk();
        } catch (error) {
          const errorMsg = `Failed to process chunk at position ${this.novelReader.getCurrentPosition()}: ${error}`;
          for (const c of createStatusChunks('orchestrator', 'error', errorMsg, {
            position: this.novelReader.getCurrentPosition(),
            error: String(error),
          })) {
            this.emitChunk(c);
          }
          logger.error(errorMsg);
          this.stats.errors.push(errorMsg);

          // Try to advance position to avoid infinite loop
          const nextPosition = Math.min(
            this.novelReader.getCurrentPosition() + this.config.chunkSize,
            this.novelReader.getContentLength()
          );
          this.novelReader.setPosition(nextPosition);
        }
      }

      // PASS 2: Timeline Resolution
      // After all chunks are processed, resolve timeline relationships
      logger.info("Event detection complete - starting timeline resolution");
      for (const c of createStatusChunks('orchestrator', 'analyzing', 'Event detection complete - starting timeline resolution')) {
        this.emitChunk(c);
      }

      await this.resolveTimeline();

      this.stats.processing = false;
      this.stats.endTime = new Date();
      this.stats.progress = 100;

      const duration = this.stats.endTime.getTime() - this.stats.startTime!.getTime();
      const finalStats = { ...this.stats };

      for (const c of createStatusChunks('orchestrator', 'completed', 'Novel analysis complete!', {
        chunksProcessed: this.stats.chunksProcessed,
        eventsFound: this.stats.eventsFound,
        errors: this.stats.errors.length,
        duration,
        finalStats,
      })) {
        this.emitChunk(c);
      }
      logger.info(`Novel processing complete - chunksProcessed: ${this.stats.chunksProcessed}, eventsFound: ${this.stats.eventsFound}, errors: ${this.stats.errors.length}, duration: ${duration}ms`);

      return finalStats;

    } catch (error) {
      this.stats.processing = false;
      this.stats.endTime = new Date();
      for (const c of createStatusChunks('orchestrator', 'error', `Novel processing failed: ${error}`, { error: String(error) })) {
        this.emitChunk(c);
      }
      logger.error(`Novel processing failed: ${error}`);
      this.stats.errors.push(`Processing failed: ${error}`);
      throw error;
    }
  }

  /**
   * Find a chunk of text in the novel, then analyze it for events, logging out
   * the results as we go.
   * @returns {Promise<void>}
   */
  private async processNextChunk(): Promise<void> {
    const currentPosition = this.novelReader.getCurrentPosition();

    // Get clean text chunk with word boundaries
    const chunkData = this.novelReader.getCleanTextChunk(
      currentPosition,
      this.config.chunkSize
    );

    const chunkNumber = this.stats.chunksProcessed + 1;

    logger.debug(
      `Processing chunk ${chunkNumber} - actualStart: ${chunkData.actualStart}, actualEnd: ${chunkData.actualEnd}, chunkLength: ${chunkData.text.length}`
    );

    const result = await this.eventDetector.simpleAnalysis(
      chunkData.text,
      chunkData.actualStart
    );

    // Handle agent response
    // TODO: Confirm that these no event found and event found parsing logics are correct with our new agent-based approach.
    if (result === "no event found") {
      for (const c of createStatusChunks('event-detector', 'success', `No events found in chunk ${chunkNumber}`)) {
        this.emitChunk(c);
      }
      logger.debug(`No events found in chunk ${this.stats.chunksProcessed + 1}`);

      // Advance position by chunk size minus overlap
      const nextPosition = Math.min(
        currentPosition + this.config.chunkSize - this.config.overlapSize,
        this.novelReader.getContentLength()
      );
      this.novelReader.setPosition(nextPosition);

    } else {
      const resultPreview = result.substring(0, 100) + '...';

      // Count events found (simple parsing of the result string)
      const eventCountMatch = result.match(/Found (\d+) event/);
      const eventCount = eventCountMatch ? parseInt(eventCountMatch[1]) : 0;

      if (eventCount > 0) {
        this.stats.eventsFound += eventCount;
        for (const c of createStatusChunks('event-detector', 'event_found', `Found ${eventCount} event(s) in chunk ${chunkNumber}`, {
          eventCount,
          chunkNumber,
          result: resultPreview,
        })) {
          this.emitChunk(c);
        }
      }

      logger.info(
        `Events found in chunk ${
          this.stats.chunksProcessed + 1
        } - result: ${resultPreview}`
      );

      // Advance position to end of processed chunk
      this.novelReader.setPosition(chunkData.actualEnd);
    }

    // Update statistics
    this.stats.chunksProcessed++;
    this.stats.currentPosition = this.novelReader.getCurrentPosition();
    this.stats.progress = this.novelReader.getProgress();

    logger.debug(`Chunk processing complete - chunksProcessed: ${this.stats.chunksProcessed}, progress: ${this.stats.progress}%, currentPosition: ${this.stats.currentPosition}`);
  }

  /**
   * Resolves timeline relationships for all detected events.
   * Groups nearby events into batches and analyzes them with surrounding context.
   * @returns {Promise<void>}
   */
  private async resolveTimeline(): Promise<void> {
    try {
      for (const c of createStatusChunks('orchestrator', 'analyzing', 'Starting timeline resolution', {
        novelName: this.novelReader.getFilename(),
      })) {
        this.emitChunk(c);
      }
      logger.info("Starting timeline resolution pass");

      // Query all events for this novel
      const allEvents = await getAllEvents(this.novelReader.getFilename());

      if (allEvents.length === 0) {
        for (const c of createStatusChunks('orchestrator', 'success', 'No events found - skipping timeline resolution')) {
          this.emitChunk(c);
        }
        logger.info("No events found - skipping timeline resolution");
        return;
      }

      logger.info(
        { eventCount: allEvents.length },
        "Retrieved all events for timeline resolution"
      );

      // Group events into batches (events within batchRadius of each other)
      const batches: typeof allEvents[] = [];
      let currentBatch: typeof allEvents = [];

      for (const event of allEvents) {
        if (currentBatch.length === 0) {
          // Start new batch
          currentBatch.push(event);
        } else {
          // Check if this event is within batchRadius of the last event in current batch
          const lastEvent = currentBatch[currentBatch.length - 1];
          const distance = event.charRangeStart - lastEvent.charRangeEnd;

          if (distance <= this.config.batchRadius) {
            // Add to current batch
            currentBatch.push(event);
          } else {
            // Start new batch
            batches.push(currentBatch);
            currentBatch = [event];
          }
        }
      }

      // Don't forget the last batch
      if (currentBatch.length > 0) {
        batches.push(currentBatch);
      }

      logger.info(
        { batchCount: batches.length, eventCount: allEvents.length },
        "Events grouped into batches"
      );

      for (const c of createStatusChunks('orchestrator', 'analyzing', `Analyzing ${batches.length} batches of events`, {
        batchCount: batches.length,
        eventCount: allEvents.length,
      })) {
        this.emitChunk(c);
      }

      // Initialize timeline resolver
      const timelineResolver = new TimelineResolverAgent(
        this.novelReader.getFilename(),
        this.emitChunk.bind(this)
      );

      // Load master events if we have them
      let masterEvents: Record<string, string>[] | undefined;
      if (this.spreadsheetPath) {
        try {
          masterEvents = await readCsv(this.spreadsheetPath);
          logger.info(
            { masterEventCount: masterEvents.length },
            "Loaded master events for timeline resolution"
          );
        } catch (error) {
          logger.warn(
            { error, spreadsheetPath: this.spreadsheetPath },
            "Failed to load master events for timeline resolution"
          );
        }
      }

      await timelineResolver.initialize(masterEvents);

      // Track statistics
      let totalRelationships = 0;
      let totalDates = 0;
      let totalMasterEvents = 0;

      // Process each batch
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchNumber = i + 1;

        try {
          logger.debug(
            { batchNumber, eventCount: batch.length },
            "Processing event batch"
          );

          // Calculate context range (min charRangeStart - margin to max charRangeEnd + margin)
          const minChar = Math.max(
            0,
            batch[0].charRangeStart - this.config.contextMargin
          );
          const maxChar = Math.min(
            this.novelReader.getContentLength(),
            batch[batch.length - 1].charRangeEnd + this.config.contextMargin
          );

          // Extract context text
          const contextText = this.novelReader.getTextChunk(minChar, maxChar);

          logger.debug(
            {
              batchNumber,
              contextRange: `${minChar}-${maxChar}`,
              contextLength: contextText.length,
            },
            "Extracted context text for batch"
          );

          // Analyze batch
          const result = await timelineResolver.analyzeBatch(batch, contextText);

          totalRelationships += result.relationshipsCreated;
          totalDates += result.datesAdded;
          totalMasterEvents += result.masterEventsLinked;

          logger.info(
            {
              batchNumber,
              relationshipsCreated: result.relationshipsCreated,
              datesAdded: result.datesAdded,
              masterEventsLinked: result.masterEventsLinked,
            },
            "Batch processing complete"
          );

          for (const c of createStatusChunks('orchestrator', 'processing', `Batch ${batchNumber}/${batches.length} complete`, {
            batchNumber,
            totalBatches: batches.length,
            progress: Math.round((batchNumber / batches.length) * 100),
            relationshipsCreated: result.relationshipsCreated,
            datesAdded: result.datesAdded,
            masterEventsLinked: result.masterEventsLinked,
          })) {
            this.emitChunk(c);
          }
        } catch (error) {
          logger.error(
            { error, batchNumber, eventCount: batch.length },
            "Failed to process batch"
          );
          for (const c of createStatusChunks('orchestrator', 'error', `Failed to process batch ${batchNumber}: ${error}`, {
            batchNumber,
            error: String(error),
          })) {
            this.emitChunk(c);
          }
          // Continue with next batch despite error
        }
      }

      logger.info(
        {
          batchesProcessed: batches.length,
          relationshipsCreated: totalRelationships,
          datesAdded: totalDates,
          masterEventsLinked: totalMasterEvents,
        },
        "Timeline resolution complete"
      );

      for (const c of createStatusChunks('orchestrator', 'completed', 'Timeline resolution complete', {
        batchesProcessed: batches.length,
        relationshipsCreated: totalRelationships,
        datesAdded: totalDates,
        masterEventsLinked: totalMasterEvents,
      })) {
        this.emitChunk(c);
      }
    } catch (error) {
      logger.error({ error }, "Timeline resolution failed");
      for (const c of createStatusChunks('orchestrator', 'error', `Timeline resolution failed: ${error}`, { error: String(error) })) {
        this.emitChunk(c);
      }
      throw new Error(`Timeline resolution failed: ${error}`);
    }
  }

  /**
   * Gets current processing statistics.
   * @returns {ProcessingStats} Current statistics
   */
  getStats(): ProcessingStats {
    return { ...this.stats };
  }

  /**
   * Gets the configuration.
   * @returns {OrchestratorConfig} Current configuration
   */
  getConfig(): OrchestratorConfig {
    return { ...this.config };
  }

  /**
   * Updates configuration (only when not processing).
   * @param {Partial<OrchestratorConfig>} updates - Configuration updates
   * @throws {Error} If processing is in progress
   */
  updateConfig(updates: Partial<OrchestratorConfig>): void {
    if (this.stats.processing) {
      throw new Error('Cannot update configuration while processing');
    }

    this.config = { ...this.config, ...updates };
    logger.info(`Configuration updated - ${JSON.stringify(this.config)}`);
  }

  /**
   * Checks if the orchestrator is currently processing.
   * @returns {boolean} True if processing
   */
  isProcessing(): boolean {
    return this.stats.processing;
  }

  /**
   * Gets the novel filename.
   * @returns {string} Novel filename
   */
  getNovelName(): string {
    return this.novelReader.getFilename();
  }

  /**
   * Gets preview of text at current position.
   * @param {number} length - Length of preview text
   * @returns {string} Preview text
   */
  getPreviewText(length: number = 200): string {
    try {
      const currentPos = this.novelReader.getCurrentPosition();
      const endPos = Math.min(currentPos + length, this.novelReader.getContentLength());
      return this.novelReader.getTextChunk(currentPos, endPos);
    } catch {
      return 'Unable to get preview text';
    }
  }
}
