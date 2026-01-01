import mammoth from 'mammoth';
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