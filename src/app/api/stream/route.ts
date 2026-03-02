import { NextRequest } from 'next/server';
import { loggers } from '@/lib/utils/logger';
import type { UIMessage } from 'ai';
import {
  orchestratorEvents,
  addConnection,
  removeConnection,
} from '@/lib/services/sse-emitter';
import { readMessages } from '@/lib/services/message-store';

const logger = loggers.api;

/**
 * GET /api/stream?filename=xyz
 * Creates an SSE connection for streaming orchestrator messages for a specific file
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

      // Send initial connection message (AI SDK Message format)
      const initialMessage: UIMessage = {
        id: crypto.randomUUID(),
        role: "system",
        parts: [
          {
            type: "text",
            text: `Connected to stream for ${filename}`,
          },
        ],
        metadata: { filename, createdAt: new Date() },
      };

      try {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(initialMessage)}\n\n`)
        );
      } catch (error) {
        logger.error({ filename, error }, 'Failed to send initial SSE message');
      }

      // Replay historical messages so the observer appears stateful on reconnect.
      // This must complete before registering the live listener to ensure messages
      // arrive in order — replayed history first, then live events from this point on.
      const pastMessages = await readMessages(filename);
      logger.info({ filename, count: pastMessages.length }, 'Replaying historical messages');
      for (const msg of pastMessages) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`));
        } catch (error) {
          logger.error({ filename, error }, 'Failed to replay historical SSE message');
          return; // Stream already closed — bail before registering live listener
        }
      }

      // Listen for orchestrator events for this filename
      const removeListener = orchestratorEvents.addListener(filename, (message) => {
        try {
          // Message is already in AI SDK format - just send it
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(message)}\n\n`)
          );

          logger.debug({ filename, role: message.role }, 'SSE message sent');
        } catch (error) {
          logger.error({ filename, error }, 'Failed to send SSE message');
          // If stream is closed, clean up
          cleanup();
        }
      });

      // Cleanup function
      const cleanup = () => {
        logger.info({ filename }, 'SSE stream cleanup');

        // Remove from connections map
        removeConnection(filename, controller);

        // Remove event listener
        removeListener();

        try {
          controller.close();
        } catch (error) {
          // Stream already closed
        }
      };

      // Set up cleanup on stream abort
      request.signal.addEventListener('abort', cleanup);

      // Keep-alive ping every 30 seconds
      const keepAlive = setInterval(() => {
        try {
          const pingMessage: UIMessage = {
            id: crypto.randomUUID(),
            role: "system",
            parts: [{ type: "text", text: "Keep-alive ping" }],
            metadata: { filename, originalType: "ping", createdAt: new Date() },
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(pingMessage)}\n\n`));
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