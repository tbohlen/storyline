import { NextRequest } from 'next/server';
import { loggers } from '@/lib/utils/logger';

const logger = loggers.api;

// Global map to store SSE connections by filename
const sseConnections = new Map<string, Set<ReadableStreamDefaultController<Uint8Array>>>();

// Global event emitter for orchestrator messages
class OrchestratorEventEmitter {
  private listeners = new Map<string, Set<(message: any) => void>>();

  emit(filename: string, message: any) {
    const listeners = this.listeners.get(filename);
    if (listeners) {
      listeners.forEach(listener => listener(message));
    }
  }

  addListener(filename: string, listener: (message: any) => void) {
    if (!this.listeners.has(filename)) {
      this.listeners.set(filename, new Set());
    }
    this.listeners.get(filename)!.add(listener);
    return () => {
      this.listeners.get(filename)?.delete(listener);
    };
  }

  removeAllListeners(filename: string) {
    this.listeners.delete(filename);
  }
}

// Global instance that orchestrator will use
export const orchestratorEvents = new OrchestratorEventEmitter();

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
    start(controller) {
      logger.info({ filename }, 'SSE stream started');

      // Add this controller to the connections map
      if (!sseConnections.has(filename)) {
        sseConnections.set(filename, new Set());
      }
      sseConnections.get(filename)!.add(controller);

      // Send initial connection message
      const initialMessage = {
        type: 'connection',
        agent: 'system',
        timestamp: new Date().toISOString(),
        message: `Connected to stream for ${filename}`,
        data: { filename }
      };

      try {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(initialMessage)}\n\n`)
        );
      } catch (error) {
        logger.error({ filename, error }, 'Failed to send initial SSE message');
      }

      // Listen for orchestrator events for this filename
      const removeListener = orchestratorEvents.addListener(filename, (message) => {
        try {
          const sseMessage = {
            ...message,
            timestamp: new Date().toISOString(),
            filename
          };

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(sseMessage)}\n\n`)
          );

          logger.debug({ filename, type: message.type }, 'SSE message sent');
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
        const connections = sseConnections.get(filename);
        if (connections) {
          connections.delete(controller);
          if (connections.size === 0) {
            sseConnections.delete(filename);
          }
        }

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
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'ping',
            agent: 'system',
            timestamp: new Date().toISOString(),
            message: 'Keep-alive ping'
          })}\n\n`));
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

/**
 * Helper function for orchestrator to emit messages
 * This will be imported and used by the orchestrator
 */
export function emitOrchestratorMessage(filename: string, message: {
  type: string;
  agent: string;
  message: string;
  data?: object;
}) {
  logger.debug({
    filename,
    type: message.type,
    agent: message.agent,
  }, "Emitting orchestrator message");
  orchestratorEvents.emit(filename, message);
}

/**
 * Get active SSE connection count for a filename
 */
export function getActiveConnections(filename: string): number {
  const connections = sseConnections.get(filename);
  return connections ? connections.size : 0;
}

/**
 * Close all SSE connections for a filename
 */
export function closeConnections(filename: string) {
  const connections = sseConnections.get(filename);
  if (connections) {
    connections.forEach(controller => {
      try {
        controller.close();
      } catch (error) {
        // Already closed
      }
    });
    sseConnections.delete(filename);
  }
  orchestratorEvents.removeAllListeners(filename);
  logger.info({ filename }, 'Closed all SSE connections');
}