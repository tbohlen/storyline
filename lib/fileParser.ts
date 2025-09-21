import mammoth from 'mammoth';
import * as xlsx from 'xlsx';
import pino from 'pino';

const logger = pino();

export async function readDocx(filePath: string): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    logger.info(`Successfully read docx file: ${filePath}`);
    return result.value;
  } catch (error) {
    logger.error({ filePath + " " + JSON.stringify(error }, `Failed to read docx file ${filePath}:`));
    throw error;
  }
}

export function readSpreadsheet(filePath: string): any[] {
  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet);
    logger.info(`Successfully read spreadsheet file: ${filePath}`);
    return jsonData;
  } catch (error) {
    logger.error({ filePath + " " + JSON.stringify(error }, `Failed to read spreadsheet file ${filePath}:`));
    throw error;
  }
}