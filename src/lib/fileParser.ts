import mammoth from 'mammoth';
import fs from 'fs/promises';
import pino from 'pino';

const logger = pino();

export async function readDocx(filePath: string): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    logger.info(`Successfully read docx file: ${filePath}`);
    return result.value;
  } catch (error) {
    logger.error({ error: `${filePath} ${JSON.stringify(error)}` }, `Failed to read docx file ${filePath}:`);
    throw error;
  }
}

/**
 * Reads a TSV file and returns the data as an array of JSON objects
 * @param {string} filePath - Path to the TSV file
 * @returns {Promise<any[]>} Array of objects representing TSV rows
 * @throws {Error} If the file cannot be read or parsed
 */
export async function readTsv(filePath: string): Promise<any[]> {
  try {
    logger.info(`Reading TSV file: ${filePath}`);

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
    const events: any[] = lines.slice(1).map((line, index) => {
      const values = line.split('\t');
      const event: any = {};

      headers.forEach((header, colIndex) => {
        const value = values[colIndex] || '';
        event[header.toLowerCase().trim()] = value.trim();
      });

      return event;
    });

    logger.info(`Successfully parsed TSV file: ${filePath} (${events.length} rows)`);
    return events;
  } catch (error) {
    logger.error({ error: `${filePath} ${JSON.stringify(error)}` }, `Failed to read TSV file ${filePath}:`);
    throw error;
  }
}

/**
 * Legacy function for backward compatibility with existing code
 * @param {string} filePath - Path to the TSV file
 * @returns {Promise<any[]>} Array of objects representing TSV rows
 * @throws {Error} If the file cannot be read or parsed
 */
export async function readSpreadsheet(filePath: string): Promise<any[]> {
  // Delegate to readTsv for backward compatibility
  return readTsv(filePath);
}