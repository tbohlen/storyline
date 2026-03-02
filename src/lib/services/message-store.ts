/**
 * Message Store Service
 *
 * Persists UIMessageChunks to per-file NDJSON logs in the /data directory.
 * Each line in the file is a complete JSON-serialized UIMessageChunk.
 *
 * This service is intentionally ignorant of SSE, agents, or orchestration.
 * It is a pure I/O layer that any part of the application can call directly.
 *
 * Future extensibility: the chat route will call appendChunk/readChunks
 * directly to persist user and AI chat messages to the same file, forming a
 * complete chronological record of the session alongside the analysis messages.
 */

import { existsSync } from 'fs';
import { appendFile, readFile } from 'fs/promises';
import { join } from 'path';
import type { UIMessageChunk } from 'ai';
import { loggers } from '../utils/logger';

const logger = loggers.messageStore;

/**
 * Returns the absolute path of the NDJSON message log for a given filename.
 *
 * @param filename - The novel filename key (e.g. "book.docx")
 * @returns Absolute path like /project/data/book.docx.messages.ndjson
 */
export function getMessageStorePath(filename: string): string {
  return join(process.cwd(), 'data', `${filename}.messages.ndjson`);
}

/**
 * Returns true if a message store file already exists for this filename.
 * Used by the process route to guard against reprocessing a file.
 *
 * @param filename - The novel filename key
 */
export function messageStoreExists(filename: string): boolean {
  return existsSync(getMessageStorePath(filename));
}

/**
 * Appends a single UIMessageChunk as a JSON line to the NDJSON file.
 *
 * This function is fire-and-forget safe: errors are logged and swallowed
 * so that a persistence failure never breaks the SSE emit path.
 * Callers on the critical path should not await this function.
 *
 * @param filename - The novel filename key
 * @param chunk - The UIMessageChunk to persist
 */
export async function appendChunk(
  filename: string,
  chunk: UIMessageChunk
): Promise<void> {
  try {
    const path = getMessageStorePath(filename);
    await appendFile(path, JSON.stringify(chunk) + '\n');
  } catch (error) {
    logger.error({ filename, error }, 'Failed to persist chunk to store');
  }
}

/**
 * Reads all persisted UIMessageChunks for a given filename.
 *
 * Returns an empty array if the file does not exist or cannot be read.
 * Each line is parsed independently; malformed lines are skipped with a
 * warning log so a single corrupt entry does not lose the full history.
 *
 * @param filename - The novel filename key
 * @returns Ordered list of UIMessageChunks from the file
 */
export async function readChunks(filename: string): Promise<UIMessageChunk[]> {
  const path = getMessageStorePath(filename);

  if (!existsSync(path)) {
    return [];
  }

  try {
    const raw = await readFile(path, 'utf-8');
    const chunks: UIMessageChunk[] = [];

    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        chunks.push(JSON.parse(trimmed) as UIMessageChunk);
      } catch (parseError) {
        logger.warn({ filename, line: trimmed.substring(0, 100), parseError }, 'Skipping malformed chunk line');
      }
    }

    return chunks;
  } catch (error) {
    logger.error({ filename, error }, 'Failed to read message store');
    return [];
  }
}
