import mammoth from 'mammoth';
import fs from 'fs/promises';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { loggers } from '../utils/logger';

const logger = loggers.fileParser;

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
    logger.info({ filePath }, 'Reading .docx file');

    // Check if file exists
    await fs.access(filePath);

    // Read the file buffer
    const buffer = await fs.readFile(filePath);

    // Extract text using mammoth
    const result = await mammoth.extractRawText({ buffer });

    if (result.messages && result.messages.length > 0) {
      logger.warn({
        filePath,
        messages: result.messages.map(m => m.message)
      }, 'Mammoth parsing messages');
    }

    logger.info({
      filePath,
      textLength: result.value.length
    }, 'Successfully extracted text from .docx file');

    return result.value;
  } catch (error) {
    logger.error({ filePath, error }, 'Failed to read .docx file');
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
    logger.info({ filePath }, 'Reading .txt file');

    // Check if file exists
    await fs.access(filePath);

    // Read the file content
    const content = await fs.readFile(filePath, 'utf-8');

    logger.info({
      filePath,
      textLength: content.length
    }, 'Successfully read .txt file');

    return content;
  } catch (error) {
    logger.error({ filePath, error }, 'Failed to read .txt file');
    throw new Error(`Failed to read .txt file "${filePath}": ${error}`);
  }
}

/**
 * Reads a CSV file and returns the data as an array of string maps
 * @param {string} filePath - Path to the CSV file
 * @returns {Promise<Record<string, string>[]>} Array of objects representing CSV rows with auto-incremented id field
 * @throws {Error} If the file cannot be read or parsed
 */
export async function readCsv(filePath: string): Promise<Record<string, string>[]> {
  try {
    logger.info({ filePath }, 'Reading CSV file');

    // Check if file exists
    await fs.access(filePath);

    // Read the file content
    const content = await fs.readFile(filePath, 'utf-8');

    // Parse CSV using csv-parse
    const records = parse(content, {
      columns: true, // Use first row as headers
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true, // Allow inconsistent column counts
    }) as Record<string, string>[];

    // Add auto-incrementing id field to each record
    const recordsWithIds = records.map((record, index) => ({
      id: String(index + 1),
      ...record
    }));

    logger.info({
      filePath,
      rowCount: recordsWithIds.length,
      columnCount: Object.keys(recordsWithIds[0] || {}).length
    }, 'Successfully parsed CSV file');

    return recordsWithIds;
  } catch (error) {
    logger.error({ filePath, error }, 'Failed to read CSV file');
    throw new Error(`Failed to read CSV file "${filePath}": ${error}`);
  }
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

  logger.debug({
    originalLength: text.length,
    chunkCount: chunks.length,
    chunkSize: size,
    overlap,
  }, "Text chunking completed");

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