/**
 * SSE (Server-Sent Events) Emitter Service
 *
 * Manages SSE connections and message broadcasting for the orchestrator system.
 * Provides a centralized, encapsulated way to handle connection lifecycle and message emission.
 */

import type { UIMessage } from 'ai';
import { loggers } from '@/lib/utils/logger';
import { appendMessage } from './message-store';

const logger = loggers.api;

// Private connection storage - not exported, only accessible through functions
const sseConnections = new Map<string, Set<ReadableStreamDefaultController<Uint8Array>>>();

/**
 * Global event emitter for orchestrator messages
 * Manages listeners for different files being processed
 */
class OrchestratorEventEmitter {
  private listeners = new Map<string, Set<(message: UIMessage) => void>>();

  emit(filename: string, message: UIMessage) {
    const listeners = this.listeners.get(filename);
    if (listeners) {
      listeners.forEach(listener => listener(message));
    }
  }

  addListener(filename: string, listener: (message: UIMessage) => void) {
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

// Next.js bundles each API route separately, which can produce multiple module
// instances. Storing the emitter on `global` ensures all bundles share one instance.
declare global {
  // eslint-disable-next-line no-var
  var __orchestratorEvents: OrchestratorEventEmitter | undefined;
}

if (!global.__orchestratorEvents) {
  global.__orchestratorEvents = new OrchestratorEventEmitter();
}

export const orchestratorEvents = global.__orchestratorEvents;

/**
 * Add an SSE connection controller for a specific file
 * @param filename - The file being processed
 * @param controller - The ReadableStream controller
 */
export function addConnection(
  filename: string,
  controller: ReadableStreamDefaultController<Uint8Array>
): void {
  if (!sseConnections.has(filename)) {
    sseConnections.set(filename, new Set());
  }
  sseConnections.get(filename)!.add(controller);
  logger.debug({ filename, totalConnections: getConnectionCount(filename) }, 'SSE connection added');
}

/**
 * Remove an SSE connection controller for a specific file
 * @param filename - The file being processed
 * @param controller - The ReadableStream controller to remove
 */
export function removeConnection(
  filename: string,
  controller: ReadableStreamDefaultController<Uint8Array>
): void {
  const connections = sseConnections.get(filename);
  if (connections) {
    connections.delete(controller);
    if (connections.size === 0) {
      sseConnections.delete(filename);
      logger.debug({ filename }, 'All SSE connections removed for file');
    }
  }
}

/**
 * Get the number of active SSE connections for a filename
 * @param filename - The file being processed
 * @returns Number of active connections
 */
export function getConnectionCount(filename: string): number {
  const connections = sseConnections.get(filename);
  return connections ? connections.size : 0;
}

/**
 * Get all connection controllers for a filename
 * Used internally by the SSE route to broadcast messages
 * @param filename - The file being processed
 * @returns Set of connection controllers, or undefined if none exist
 */
export function getConnections(
  filename: string
): Set<ReadableStreamDefaultController<Uint8Array>> | undefined {
  return sseConnections.get(filename);
}

/**
 * Helper function for orchestrator to emit messages
 * This will be imported and used by the orchestrator
 * Messages are now in AI SDK Message format
 *
 * @param filename - The file being processed
 * @param message - The UIMessage to emit
 */
export function emitUIMessage(filename: string, message: UIMessage): void {
  logger.debug({
    filename,
    role: message.role,
  }, "Emitting orchestrator message");
  orchestratorEvents.emit(filename, message);
  // Persist fire-and-forget; errors are swallowed inside appendMessage
  appendMessage(filename, message);
}

/**
 * Close all SSE connections for a filename
 * Cleans up both the connections and event listeners
 *
 * @param filename - The file being processed
 */
export function closeConnections(filename: string): void {
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
