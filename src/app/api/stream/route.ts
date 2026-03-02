import { NextRequest } from 'next/server';
import { loggers } from '@/lib/utils/logger';
import type { UIMessageChunk } from 'ai';
import {
  orchestratorEvents,
  addConnection,
  removeConnection,
} from '@/lib/services/sse-emitter';
import { readChunks } from '@/lib/services/message-store';

const logger = loggers.api;

/**
 * GET /api/stream?filename=xyz
 * Creates an SSE connection for streaming UIMessageChunks for a specific file.
 * On connect, replays all persisted chunks so the client can reconstruct state.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filename = searchParams.get('filename');

  if (!filename) {
    return new Response('Missing filename parameter', { status: 400 });
  }

  logger.info({ filename }, 'SSE connection requested');

  const encoder = new TextEncoder();

  // Create SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      logger.info({ filename }, 'SSE stream started');

      // Add this controller to the connections map
      addConnection(filename, controller);

      // Replay historical chunks so the observer appears stateful on reconnect.
      // This must complete before registering the live listener to ensure chunks
      // arrive in order — replayed history first, then live events from this point on.
      const pastChunks = await readChunks(filename);
      logger.info({ filename, count: pastChunks.length }, 'Replaying historical chunks');
      for (const chunk of pastChunks) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        } catch (error) {
          logger.error({ filename, error }, 'Failed to replay historical SSE chunk');
          return; // Stream already closed — bail before registering live listener
        }
      }

      // Listen for orchestrator events for this filename
      const removeListener = orchestratorEvents.addListener(filename, (chunk: UIMessageChunk) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`)
          );
          logger.debug({ filename, chunkType: chunk.type }, 'SSE chunk sent');
        } catch (error) {
          logger.error({ filename, error }, 'Failed to send SSE chunk');
          cleanup();
        }
      });

      // Cleanup function
      const cleanup = () => {
        logger.info({ filename }, 'SSE stream cleanup');
        removeConnection(filename, controller);
        removeListener();
        try {
          controller.close();
        } catch (error) {
          // Stream already closed
        }
      };

      // Set up cleanup on stream abort
      request.signal.addEventListener('abort', cleanup);

      // Keep-alive via SSE comment line — not stored or parsed by the client
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'));
        } catch (error) {
          clearInterval(keepAlive);
          cleanup();
        }
      }, 30000);

      // Cleanup on stream end
      return () => {
        clearInterval(keepAlive);
        cleanup();
      };
    },

    cancel() {
      logger.info({ filename }, 'SSE stream cancelled');
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  });
}
