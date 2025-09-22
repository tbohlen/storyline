import mammoth from 'mammoth';
import fs from 'fs/promises';
import path from 'path';
import { loggers } from '../utils/logger';

const logger = loggers.fileParser;

/**
 * Interface for TSV event data
 */
export interface SpreadsheetEvent {
  id?: string;
  description?: string;
  category?: string;
  book?: string;
  chapter?: string;
  [key: string]: any; // Allow for additional columns
}

/**
 * Interface for text chunking options
 */
export interface ChunkOptions {
  size: number; // Number of characters per chunk
  overlap: number; // Number of characters to overlap between chunks
}

/**
 * Interface for text chunk
 */
export interface TextChunk {
  text: string;
  startIndex: number;
  endIndex: number;
  chunkNumber: number;
}

/**
 * Reads and extracts text content from a .docx file
 * @param {string} filePath - Path to the .docx file
 * @returns {Promise<string>} The extracted text content
 * @throws {Error} If the file cannot be read or parsed
 */
export async function readDocx(filePath: string): Promise<string> {
  try {
    logger.info('Reading .docx file', { filePath });

    // Check if file exists
    await fs.access(filePath);

    // Read the file buffer
    const buffer = await fs.readFile(filePath);

    // Extract text using mammoth
    const result = await mammoth.extractRawText({ buffer });

    if (result.messages && result.messages.length > 0) {
      logger.warn('Mammoth parsing messages', {
        filePath,
        messages: result.messages.map(m => m.message)
      });
    }

    logger.info('Successfully extracted text from .docx file', {
      filePath,
      textLength: result.value.length
    });

    return result.value;
  } catch (error) {
    logger.error('Failed to read .docx file', { filePath, error });
    throw new Error(`Failed to read .docx file "${filePath}": ${error}`);
  }
}

/**
 * Reads and extracts text content from a .txt file
 * @param {string} filePath - Path to the .txt file
 * @returns {Promise<string>} The extracted text content
 * @throws {Error} If the file cannot be read
 */
export async function readTxt(filePath: string): Promise<string> {
  try {
    logger.info('Reading .txt file', { filePath });

    // Check if file exists
    await fs.access(filePath);

    // Read the file content
    const content = await fs.readFile(filePath, 'utf-8');

    logger.info('Successfully read .txt file', {
      filePath,
      textLength: content.length
    });

    return content;
  } catch (error) {
    logger.error('Failed to read .txt file', { filePath, error });
    throw new Error(`Failed to read .txt file "${filePath}": ${error}`);
  }
}

/**
 * Reads a TSV file and returns the data as an array of JSON objects
 * @param {string} filePath - Path to the TSV file
 * @returns {Promise<SpreadsheetEvent[]>} Array of objects representing TSV rows
 * @throws {Error} If the file cannot be read or parsed
 */
export async function readTsv(filePath: string): Promise<SpreadsheetEvent[]> {
  try {
    logger.info('Reading TSV file', { filePath });

    // Check if file exists
    await fs.access(filePath);

    // Read the file content
    const content = await fs.readFile(filePath, 'utf-8');

    // Split into lines and filter out empty lines
    const lines = content.split('\n').filter(line => line.trim().length > 0);

    if (lines.length === 0) {
      return [];
    }

    // Get headers from first line
    const headers = lines[0].split('\t').map(header => header.trim());

    // Convert remaining lines to objects
    const events: SpreadsheetEvent[] = lines.slice(1).map((line, index) => {
      const values = line.split('\t');
      const event: SpreadsheetEvent = {};

      headers.forEach((header, colIndex) => {
        const value = values[colIndex] || '';
        event[header.toLowerCase().trim()] = value.trim();
      });

      return event;
    });

    logger.info('Successfully parsed TSV file', {
      filePath,
      rowCount: events.length,
      columnCount: headers.length
    });

    return events;
  } catch (error) {
    logger.error('Failed to read TSV file', { filePath, error });
    throw new Error(`Failed to read TSV file "${filePath}": ${error}`);
  }
}

/**
 * Legacy function for backward compatibility with existing code
 * @param {string} filePath - Path to the TSV file
 * @returns {Promise<SpreadsheetEvent[]>} Array of objects representing TSV rows
 * @throws {Error} If the file cannot be read or parsed
 */
export async function readSpreadsheet(filePath: string): Promise<SpreadsheetEvent[]> {
  // Delegate to readTsv for backward compatibility
  return readTsv(filePath);
}

/**
 * Chunks text into smaller segments with optional overlap
 * @param {string} text - The text to chunk
 * @param {ChunkOptions} options - Chunking options
 * @returns {TextChunk[]} Array of text chunks
 */
export function chunkText(text: string, options: ChunkOptions): TextChunk[] {
  const { size, overlap } = options;
  const chunks: TextChunk[] = [];

  if (text.length === 0) {
    return chunks;
  }

  let startIndex = 0;
  let chunkNumber = 0;

  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + size, text.length);
    const chunkText = text.slice(startIndex, endIndex);

    chunks.push({
      text: chunkText,
      startIndex,
      endIndex,
      chunkNumber: chunkNumber++,
    });

    // Move start index forward, accounting for overlap
    startIndex += size - overlap;

    // If we're at the end and would create a tiny chunk, break
    if (startIndex >= text.length) {
      break;
    }

    // If remaining text is smaller than overlap, include it all in the last chunk
    if (text.length - startIndex < overlap) {
      break;
    }
  }

  logger.debug('Text chunking completed', {
    originalLength: text.length,
    chunkCount: chunks.length,
    chunkSize: size,
    overlap
  });

  return chunks;
}

/**
 * Gets the file extension and determines the appropriate parser
 * @param {string} filePath - Path to the file
 * @returns {Promise<string>} The extracted text content
 * @throws {Error} If file type is not supported
 */
export async function readFile(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case '.docx':
      return readDocx(filePath);
    case '.txt':
      return readTxt(filePath);
    default:
      throw new Error(`Unsupported file type: ${ext}. Supported types: .docx, .txt`);
  }
}