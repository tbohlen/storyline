import { NovelReader } from './novelReader';
import { EventDetectorAgent } from '../agents/eventDetector';
import { initializeDatabase } from './database';
import { loggers } from '../utils/logger';

const logger = loggers.orchestrator;

// Import SSE emitter function
let emitOrchestratorMessage: ((filename: string, message: any) => void) | null = null;

// Dynamic import to avoid circular dependency issues
const initializeSSE = async () => {
  if (!emitOrchestratorMessage) {
    try {
      const sseModule = await import('../../app/api/stream/route');
      emitOrchestratorMessage = sseModule.emitOrchestratorMessage;
    } catch (error) {
      logger.error('Failed to import SSE emitter', { error });
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
  private filename: string;

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
   * Emits a message to the SSE stream
   * @param {string} type - Message type
   * @param {string} agent - Agent name
   * @param {string} message - Message content
   * @param {any} data - Optional additional data
   */
  private emitMessage(type: string, agent: string, message: string, data?: any) {
    if (emitOrchestratorMessage) {
      emitOrchestratorMessage(this.filename, {
        type,
        agent,
        message,
        data
      });
    }
  }

  /**
   * Initializes all services and prepares for processing
   * @returns {Promise<void>}
   */
  async initialize(): Promise<void> {
    try {
      this.emitMessage('status', 'orchestrator', 'Initializing orchestrator services...');
      logger.info('Initializing orchestrator services');

      // Initialize database schema
      this.emitMessage('status', 'orchestrator', 'Setting up database schema...');
      await initializeDatabase();
      logger.info('Database initialized');

      // Load the novel
      this.emitMessage('status', 'orchestrator', `Loading novel: ${this.filename}`);
      await this.novelReader.loadNovel();
      this.stats.totalCharacters = this.novelReader.getContentLength();
      logger.info(`Novel loaded - filename: ${this.novelReader.getFilename()}, totalCharacters: ${this.stats.totalCharacters}`);

      // Initialize event detector with master events
      this.emitMessage('status', 'orchestrator', 'Initializing Event Detector agent...');
      await this.eventDetector.initialize(this.spreadsheetPath);
      logger.info('Event detector initialized');

      this.emitMessage('success', 'orchestrator', 'Orchestrator initialization complete', {
        totalCharacters: this.stats.totalCharacters,
        chunkSize: this.config.chunkSize,
        overlapSize: this.config.overlapSize
      });
      logger.info('Orchestrator initialization complete');

    } catch (error) {
      const errorMessage = `Initialization failed: ${error}`;
      this.emitMessage('error', 'orchestrator', errorMessage, { error: String(error) });
      logger.error(`Failed to initialize orchestrator: ${error}`);
      this.stats.errors.push(errorMessage);
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

      this.emitMessage('status', 'orchestrator', `Starting novel analysis - ${this.stats.totalCharacters} characters`, {
        totalCharacters: this.stats.totalCharacters,
        chunkSize: this.config.chunkSize,
        overlapSize: this.config.overlapSize
      });
      logger.info(`Starting novel processing - totalCharacters: ${this.stats.totalCharacters}, chunkSize: ${this.config.chunkSize}, overlapSize: ${this.config.overlapSize}`);

      // Reset reader position
      this.novelReader.setPosition(0);

      while (!this.novelReader.isAtEnd()) {
        try {
          await this.processNextChunk();
        } catch (error) {
          const errorMsg = `Failed to process chunk at position ${this.novelReader.getCurrentPosition()}: ${error}`;
          this.emitMessage('error', 'orchestrator', errorMsg, {
            position: this.novelReader.getCurrentPosition(),
            error: String(error)
          });
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
      const finalStats = { ...this.stats };

      this.emitMessage('completed', 'orchestrator', `Novel analysis complete!`, {
        chunksProcessed: this.stats.chunksProcessed,
        eventsFound: this.stats.eventsFound,
        errors: this.stats.errors.length,
        duration: duration,
        finalStats
      });
      logger.info(`Novel processing complete - chunksProcessed: ${this.stats.chunksProcessed}, eventsFound: ${this.stats.eventsFound}, errors: ${this.stats.errors.length}, duration: ${duration}ms`);

      return finalStats;

    } catch (error) {
      this.stats.processing = false;
      this.stats.endTime = new Date();
      this.emitMessage('error', 'orchestrator', `Novel processing failed: ${error}`, { error: String(error) });
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
    const preview = chunkData.text.substring(0, 100).replace(/\n/g, ' ') + '...';

    this.emitMessage('processing', 'orchestrator', `Processing chunk ${chunkNumber}`, {
      chunkNumber,
      chunkStart: chunkData.actualStart,
      chunkEnd: chunkData.actualEnd,
      chunkLength: chunkData.text.length,
      preview,
      progress: this.novelReader.getProgress()
    });

    logger.debug(`Processing chunk ${chunkNumber} - actualStart: ${chunkData.actualStart}, actualEnd: ${chunkData.actualEnd}, chunkLength: ${chunkData.text.length}`);

    // Analyze chunk for events
    this.emitMessage('analyzing', 'event-detector', `Analyzing chunk ${chunkNumber} for events`, {
      chunkLength: chunkData.text.length,
      preview
    });

    const result = await this.eventDetector.simpleAnalysis(
      chunkData.text,
      chunkData.actualStart
    );

    // Handle agent response
    if (result === "no event found") {
      this.emitMessage('result', 'event-detector', `No events found in chunk ${chunkNumber}`);
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
        this.emitMessage('event_found', 'event-detector', `Found ${eventCount} event(s) in chunk ${chunkNumber}`, {
          eventCount,
          chunkNumber,
          result: resultPreview
        });
      }

      logger.info(`Events found in chunk ${this.stats.chunksProcessed + 1} - result: ${resultPreview}`);

      // Advance position to end of processed chunk
      this.novelReader.setPosition(chunkData.actualEnd);
    }

    // Update statistics
    this.stats.chunksProcessed++;
    this.stats.currentPosition = this.novelReader.getCurrentPosition();
    this.stats.progress = this.novelReader.getProgress();

    // Emit progress update
    this.emitMessage('progress', 'orchestrator', `Chunk ${chunkNumber} processed`, {
      chunksProcessed: this.stats.chunksProcessed,
      eventsFound: this.stats.eventsFound,
      progress: this.stats.progress,
      currentPosition: this.stats.currentPosition
    });

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