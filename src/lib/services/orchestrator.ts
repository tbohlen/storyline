import { NovelReader } from './novelReader';
import { EventDetectorAgent } from '../agents/eventDetector';
import { initializeDatabase } from './database';
import path from 'path';
import { loggers } from '../utils/logger';

const logger = loggers.orchestrator;

/**
 * Configuration for the orchestrator
 */
export interface OrchestratorConfig {
  chunkSize: number;           // Size of text chunks to process
  overlapSize: number;         // Overlap between chunks to avoid cutting events
  maxRetries: number;          // Max retries for failed operations
  eventDistance: number;       // Distance for relationship detection (not used yet)
  maxEventCount: number;       // Max events per relationship group (not used yet)
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: OrchestratorConfig = {
  chunkSize: 1000,
  overlapSize: 200,
  maxRetries: 3,
  eventDistance: 5000,
  maxEventCount: 10
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
 * Main Orchestrator Service
 * Manages the complete workflow of loading novels, chunking text, and coordinating agents
 */
export class Orchestrator {
  private novelReader: NovelReader;
  private eventDetector: EventDetectorAgent;
  private config: OrchestratorConfig;
  private stats: ProcessingStats;

  /**
   * Creates a new Orchestrator instance
   * @param {string} novelPath - Path to the novel file
   * @param {string} spreadsheetPath - Path to the master events spreadsheet
   * @param {Partial<OrchestratorConfig>} config - Optional configuration overrides
   */
  constructor(
    private novelPath: string,
    private spreadsheetPath: string,
    config: Partial<OrchestratorConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize services
    this.novelReader = new NovelReader(novelPath);
    this.eventDetector = new EventDetectorAgent(this.novelReader.getFilename());

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
  }

  /**
   * Initializes all services and prepares for processing
   * @returns {Promise<void>}
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing orchestrator services');

      // Initialize database schema
      await initializeDatabase();
      logger.info('Database initialized');

      // Load the novel
      await this.novelReader.loadNovel();
      this.stats.totalCharacters = this.novelReader.getContentLength();
      logger.info(`Novel loaded - filename: ${this.novelReader.getFilename()}, totalCharacters: ${this.stats.totalCharacters}`);

      // Initialize event detector with master events
      await this.eventDetector.initialize(this.spreadsheetPath);
      logger.info('Event detector initialized');

      logger.info('Orchestrator initialization complete');

    } catch (error) {
      logger.error(`Failed to initialize orchestrator: ${error}`);
      this.stats.errors.push(`Initialization failed: ${error}`);
      throw new Error(`Orchestrator initialization failed: ${error}`);
    }
  }

  /**
   * Processes the entire novel for event detection
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

      logger.info(`Starting novel processing - totalCharacters: ${this.stats.totalCharacters}, chunkSize: ${this.config.chunkSize}, overlapSize: ${this.config.overlapSize}`);

      // Reset reader position
      this.novelReader.setPosition(0);

      while (!this.novelReader.isAtEnd()) {
        try {
          await this.processNextChunk();
        } catch (error) {
          const errorMsg = `Failed to process chunk at position ${this.novelReader.getCurrentPosition()}: ${error}`;
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

      this.stats.processing = false;
      this.stats.endTime = new Date();
      this.stats.progress = 100;

      const duration = this.stats.endTime.getTime() - this.stats.startTime!.getTime();
      logger.info(`Novel processing complete - chunksProcessed: ${this.stats.chunksProcessed}, eventsFound: ${this.stats.eventsFound}, errors: ${this.stats.errors.length}, duration: ${duration}ms`);

      return { ...this.stats };

    } catch (error) {
      this.stats.processing = false;
      this.stats.endTime = new Date();
      logger.error(`Novel processing failed: ${error}`);
      this.stats.errors.push(`Processing failed: ${error}`);
      throw error;
    }
  }

  /**
   * Processes the next text chunk
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
    logger.debug(`Processing chunk ${chunkNumber} - actualStart: ${chunkData.actualStart}, actualEnd: ${chunkData.actualEnd}, chunkLength: ${chunkData.text.length}`);

    // Analyze chunk for events
    const result = await this.eventDetector.simpleAnalysis(
      chunkData.text,
      chunkData.actualStart
    );

    // Handle agent response
    if (result === "no event found") {
      logger.debug(`No events found in chunk ${this.stats.chunksProcessed + 1}`);

      // Advance position by chunk size minus overlap
      const nextPosition = Math.min(
        currentPosition + this.config.chunkSize - this.config.overlapSize,
        this.novelReader.getContentLength()
      );
      this.novelReader.setPosition(nextPosition);

    } else {
      const resultPreview = result.substring(0, 100) + '...';
      logger.info(`Events found in chunk ${this.stats.chunksProcessed + 1} - result: ${resultPreview}`);

      // Count events found (simple parsing of the result string)
      const eventCountMatch = result.match(/Found (\d+) event/);
      if (eventCountMatch) {
        this.stats.eventsFound += parseInt(eventCountMatch[1]);
      }

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
   * Gets current processing statistics
   * @returns {ProcessingStats} Current statistics
   */
  getStats(): ProcessingStats {
    return { ...this.stats };
  }

  /**
   * Gets the configuration
   * @returns {OrchestratorConfig} Current configuration
   */
  getConfig(): OrchestratorConfig {
    return { ...this.config };
  }

  /**
   * Updates configuration (only when not processing)
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
   * Checks if the orchestrator is currently processing
   * @returns {boolean} True if processing
   */
  isProcessing(): boolean {
    return this.stats.processing;
  }

  /**
   * Gets the novel filename
   * @returns {string} Novel filename
   */
  getNovelName(): string {
    return this.novelReader.getFilename();
  }

  /**
   * Gets preview of text at current position
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