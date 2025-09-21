import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import fs from 'fs/promises';
import path from 'path';
import pino from 'pino';

const logger = pino({ name: 'file-parser' });

/**
 * Interface for spreadsheet event data
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
 * Reads a spreadsheet file and returns the data as an array of JSON objects
 * @param {string} filePath - Path to the spreadsheet file (.xlsx, .xls, .csv, .tsv)
 * @param {string} sheetName - Optional sheet name (defaults to first sheet)
 * @returns {Promise<SpreadsheetEvent[]>} Array of objects representing spreadsheet rows
 * @throws {Error} If the file cannot be read or parsed
 */
export async function readSpreadsheet(
  filePath: string,
  sheetName?: string
): Promise<SpreadsheetEvent[]> {
  try {
    logger.info('Reading spreadsheet file', { filePath, sheetName });

    // Check if file exists
    await fs.access(filePath);

    // Determine file extension
    const ext = path.extname(filePath).toLowerCase();
    let workbook: XLSX.WorkBook;

    if (ext === '.csv' || ext === '.tsv') {
      // Read as text file first
      const csvContent = await fs.readFile(filePath, 'utf-8');
      const delimiter = ext === '.csv' ? ',' : '\t';
      workbook = XLSX.read(csvContent, { type: 'string', delimiter });
    } else {
      // Read as binary file for Excel formats
      const buffer = await fs.readFile(filePath);
      workbook = XLSX.read(buffer, { type: 'buffer' });
    }

    // Get the target sheet
    const targetSheetName = sheetName || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[targetSheetName];

    if (!worksheet) {
      throw new Error(`Sheet "${targetSheetName}" not found in file`);
    }

    // Convert worksheet to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1, // Use first row as header
      defval: '', // Default value for empty cells
    }) as any[][];

    // If no data, return empty array
    if (jsonData.length === 0) {
      return [];
    }

    // Get headers from first row
    const headers = jsonData[0] as string[];

    // Convert rows to objects
    const events: SpreadsheetEvent[] = jsonData.slice(1).map((row, index) => {
      const event: SpreadsheetEvent = {};
      headers.forEach((header, colIndex) => {
        const value = row[colIndex];
        event[header.toLowerCase().trim()] = value || '';
      });
      return event;
    });

    logger.info('Successfully parsed spreadsheet file', {
      filePath,
      sheetName: targetSheetName,
      rowCount: events.length,
      columnCount: headers.length
    });

    return events;
  } catch (error) {
    logger.error('Failed to read spreadsheet file', { filePath, error });
    throw new Error(`Failed to read spreadsheet file "${filePath}": ${error}`);
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