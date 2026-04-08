/**
 * Tools that give the chat agent direct read access to the novel source file.
 * These are chat-only tools — they make no sense in the orchestrator context
 * where the text is already chunked and supplied directly.
 *
 * Three tools are provided:
 *   - get_novel_info    : total size and estimated page/word counts
 *   - read_text_range   : read a character-position slice with optional padding
 *   - search_text       : fuzzy full-text search via Fuse.js
 */

import { join } from 'path';
import { tool } from 'ai';
import { z } from 'zod';
import Fuse from 'fuse.js';
import { readFile } from '../services/fileParser';
import type { EventToolContext } from './event-tools';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Derive the absolute file path for a novel from its stored filename. */
function novelPath(novelName: string): string {
  return join(process.cwd(), 'data', novelName);
}

/**
 * Split `text` into overlapping passages suitable for Fuse.js indexing.
 * Each passage records its start offset within the full text so matches
 * can be mapped back to absolute character positions.
 */
function buildPassages(
  text: string,
  chunkSize = 500,
  overlap = 100
): Array<{ text: string; startChar: number }> {
  const passages: Array<{ text: string; startChar: number }> = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    passages.push({ text: text.slice(start, end), startChar: start });
    if (end === text.length) break;
    start += chunkSize - overlap;
  }
  return passages;
}

// ---------------------------------------------------------------------------
// Tool: get_novel_info
// ---------------------------------------------------------------------------

/**
 * Returns size and orientation statistics for the novel.
 * Useful before exploring ranges or pages so the agent can plan queries.
 */
function getNovelInfoTool(context: EventToolContext) {
  return tool({
    description:
      'Returns basic statistics about the novel: total character count, ' +
      'estimated word count, and estimated page count. Call this first when ' +
      'the user asks about novel length or when you need to plan a range-based query.',
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const text = await readFile(novelPath(context.novelName));
        const totalChars = text.length;
        const estimatedWords = Math.round(totalChars / 5);
        const estimatedPages = Math.round(totalChars / 1800);
        return { success: true, filename: context.novelName, totalChars, estimatedWords, estimatedPages };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, message };
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Tool: read_text_range
// ---------------------------------------------------------------------------

/**
 * Reads a contiguous slice of the novel text by character position.
 * Accepts an optional `padding` to expand the window by that many characters
 * on each side — useful for reading context around an event's stored positions.
 */
function readTextRangeTool(context: EventToolContext) {
  return tool({
    description:
      'Read a slice of the novel text between two character positions. ' +
      'Use this after obtaining event positions from get_events_in_range or find_event ' +
      'to inspect the source text around that event. ' +
      'The `padding` parameter expands the window by that many characters on each side.',
    inputSchema: z.object({
      startChar: z
        .number()
        .int()
        .nonnegative()
        .describe('Starting character offset (inclusive, 0-indexed).'),
      endChar: z
        .number()
        .int()
        .positive()
        .describe('Ending character offset (exclusive). Must be greater than startChar.'),
      padding: z
        .number()
        .int()
        .nonnegative()
        .max(500)
        .optional()
        .default(0)
        .describe('Extra characters to include before startChar and after endChar (max 500).'),
    }),
    execute: async ({ startChar, endChar, padding }) => {
      if (endChar <= startChar) {
        return { success: false, message: 'endChar must be greater than startChar.' };
      }
      try {
        const text = await readFile(novelPath(context.novelName));
        const paddedStart = Math.max(0, startChar - padding);
        const paddedEnd = Math.min(text.length, endChar + padding);
        return {
          success: true,
          text: text.slice(paddedStart, paddedEnd),
          startChar: paddedStart,
          endChar: paddedEnd,
          totalChars: text.length,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, message };
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Tool: search_text
// ---------------------------------------------------------------------------

/**
 * Fuzzy full-text search using Fuse.js.
 * The novel is split into overlapping ~500-char passages and indexed; Fuse
 * scores each passage against the query. Results include the matched passage's
 * absolute character position so the agent can follow up with read_text_range.
 */
function searchTextTool(context: EventToolContext) {
  return tool({
    description:
      'Fuzzy search the novel text for passages that match a query. ' +
      'Unlike an exact substring search this will surface relevant passages ' +
      'even when the wording differs. Returns matches sorted by relevance with ' +
      'their absolute character positions so you can follow up with read_text_range. ' +
      'Use this to find where a character, place, or event appears in the text.',
    inputSchema: z.object({
      query: z
        .string()
        .min(1)
        .describe('The phrase or description to search for.'),
      maxResults: z
        .number()
        .int()
        .positive()
        .max(10)
        .optional()
        .default(5)
        .describe('Maximum number of matching passages to return (max 10).'),
      contextChars: z
        .number()
        .int()
        .positive()
        .max(500)
        .optional()
        .default(200)
        .describe('Characters of surrounding context to include around each match (max 500).'),
      threshold: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .default(0.4)
        .describe(
          'Fuse.js match threshold (0 = exact match only, 1 = match anything). ' +
          'Lower values are stricter. Default 0.4 works well for most queries.'
        ),
    }),
    execute: async ({ query, maxResults, contextChars, threshold }) => {
      try {
        const text = await readFile(novelPath(context.novelName));
        const passages = buildPassages(text);

        const fuse = new Fuse(passages, {
          keys: ['text'],
          includeScore: true,
          threshold,
          // ignoreLocation is critical: without it Fuse heavily penalises
          // matches that don't appear near the start of the passage string.
          ignoreLocation: true,
        });

        const results = fuse.search(query, { limit: maxResults });

        const matches = results.map(({ item, score }) => {
          const matchStart = item.startChar;
          const matchEnd = Math.min(item.startChar + item.text.length, text.length);
          const contextStart = Math.max(0, matchStart - contextChars);
          const contextEnd = Math.min(text.length, matchEnd + contextChars);
          return {
            score: score ?? 1,
            matchStart,
            matchEnd,
            contextStart,
            contextEnd,
            context: text.slice(contextStart, contextEnd),
          };
        });

        return { success: true, matches, totalChars: text.length };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, message };
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates the suite of novel file-reading tools for the chat agent.
 * These tools give the agent direct read access to the source text so it can
 * verify quotes, read context around events, and search for character/place mentions.
 *
 * @param context - EventToolContext; only `novelName` is used by these tools.
 */
export function createNovelTools(context: EventToolContext) {
  return {
    get_novel_info: getNovelInfoTool(context),
    read_text_range: readTextRangeTool(context),
    search_text: searchTextTool(context),
  };
}
