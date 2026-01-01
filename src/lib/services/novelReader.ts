import { readFile } from './fileParser';
import { loggers } from '../utils/logger';

const logger = loggers.novelReader;

/**
 * Service for managing novel text reading and position tracking
 */
export class NovelReader {
  private content: string = '';
  private currentPosition: number = 0;
  private filename: string = '';

  /**
   * Creates a new NovelReader instance
   * @param {string} filePath - Path to the novel file
   */
  constructor(private filePath: string) {
    this.filename = filePath.split('/').pop() || filePath;
  }

  /**
   * Loads the novel content from the file
   * @returns {Promise<void>}
   */
  async loadNovel(): Promise<void> {
    try {
      logger.info('Loading novel', { filePath: this.filePath });

      this.content = await readFile(this.filePath);
      this.currentPosition = 0;

      logger.info('Novel loaded successfully', {
        filename: this.filename,
        contentLength: this.content.length
      });

    } catch (error) {
      logger.error('Failed to load novel', { filePath: this.filePath, error });
      throw new Error(`Failed to load novel: ${error}`);
    }
  }

  /**
   * Gets a specific text chunk by character range
   * @param {number} startChar - Starting character position
   * @param {number} endChar - Ending character position
   * @returns {string} The text chunk
   * @throws {Error} If the range is invalid
   */
  getTextChunk(startChar: number, endChar: number): string {
    if (!this.content) {
      throw new Error('Novel not loaded. Call loadNovel() first.');
    }

    if (startChar < 0 || endChar > this.content.length || startChar >= endChar) {
      throw new Error(`Invalid character range: ${startChar}-${endChar}. Content length: ${this.content.length}`);
    }

    const chunk = this.content.slice(startChar, endChar);

    logger.debug('Retrieved text chunk', {
      startChar,
      endChar,
      chunkLength: chunk.length
    });

    return chunk;
  }

  /**
   * Gets the next text chunk from the current position
   * @param {number} size - Number of characters to read
   * @returns {string | null} The text chunk, or null if at end of content
   */
  getNextTextChunk(size: number): string | null {
    if (!this.content) {
      throw new Error('Novel not loaded. Call loadNovel() first.');
    }

    if (this.currentPosition >= this.content.length) {
      logger.debug('Reached end of content', {
        currentPosition: this.currentPosition,
        contentLength: this.content.length
      });
      return null;
    }

    const endPosition = Math.min(this.currentPosition + size, this.content.length);
    const chunk = this.content.slice(this.currentPosition, endPosition);

    logger.debug('Retrieved next text chunk', {
      currentPosition: this.currentPosition,
      endPosition,
      chunkLength: chunk.length
    });

    // Don't advance position yet - let orchestrator manage this
    return chunk;
  }

  /**
   * Advances the current reading position
   * @param {number} newPosition - New position to set
   */
  setPosition(newPosition: number): void {
    if (newPosition < 0 || newPosition > this.content.length) {
      throw new Error(`Invalid position: ${newPosition}. Content length: ${this.content.length}`);
    }

    const oldPosition = this.currentPosition;
    this.currentPosition = newPosition;

    logger.debug('Updated reading position', {
      oldPosition,
      newPosition: this.currentPosition
    });
  }

  /**
   * Gets the current reading position
   * @returns {number} Current character position
   */
  getCurrentPosition(): number {
    return this.currentPosition;
  }

  /**
   * Gets the total content length
   * @returns {number} Total character count
   */
  getContentLength(): number {
    return this.content.length;
  }

  /**
   * Gets the filename without path
   * @returns {string} The filename
   */
  getFilename(): string {
    return this.filename;
  }

  /**
   * Checks if we've reached the end of the content
   * @returns {boolean} True if at end of content
   */
  isAtEnd(): boolean {
    return this.currentPosition >= this.content.length;
  }

  /**
   * Gets reading progress as a percentage
   * @returns {number} Progress percentage (0-100)
   */
  getProgress(): number {
    if (!this.content) return 0;
    return Math.round((this.currentPosition / this.content.length) * 100);
  }

  /**
   * Finds the next word boundary after a given position
   * Useful for creating clean text chunks that don't cut off mid-word
   * @param {number} position - Starting position
   * @param {boolean} forward - Search forward (true) or backward (false)
   * @returns {number} Position of word boundary
   */
  findWordBoundary(position: number, forward: boolean = true): number {
    if (!this.content) {
      throw new Error('Novel not loaded. Call loadNovel() first.');
    }

    if (position < 0) position = 0;
    if (position >= this.content.length) position = this.content.length - 1;

    const wordBoundaryRegex = /[\s\n\r\t.,!?;:"'(){}[\]]/;

    if (forward) {
      // Search forward for next word boundary
      for (let i = position; i < this.content.length; i++) {
        if (wordBoundaryRegex.test(this.content[i])) {
          return i;
        }
      }
      return this.content.length;
    } else {
      // Search backward for previous word boundary
      for (let i = position; i >= 0; i--) {
        if (wordBoundaryRegex.test(this.content[i])) {
          return i + 1; // Return position after the boundary
        }
      }
      return 0;
    }
  }

  /**
   * Gets a text chunk with clean word boundaries
   * @param {number} startChar - Starting character position
   * @param {number} size - Desired chunk size
   * @returns {Object} Object with text and actual start/end positions
   */
  getCleanTextChunk(startChar: number, size: number): {
    text: string;
    actualStart: number;
    actualEnd: number;
  } {
    // If we're at or past the end, return empty chunk
    if (startChar >= this.content.length) {
      return {
        text: '',
        actualStart: this.content.length,
        actualEnd: this.content.length
      };
    }

    const idealEnd = startChar + size;
    const cleanStart = this.findWordBoundary(startChar, false);
    const cleanEnd = this.findWordBoundary(Math.min(idealEnd, this.content.length), true);

    // Handle edge case where word boundaries create invalid range
    // This can happen at the very end of content
    if (cleanStart >= cleanEnd) {
      // Just return remaining content from startChar to end
      return {
        text: this.content.slice(startChar),
        actualStart: startChar,
        actualEnd: this.content.length
      };
    }

    return {
      text: this.getTextChunk(cleanStart, cleanEnd),
      actualStart: cleanStart,
      actualEnd: cleanEnd
    };
  }
}