/**
 * SSE Chat Transport
 *
 * Implements the AI SDK ChatTransport interface by reading UIMessageChunks
 * from the /api/stream SSE endpoint. This allows useChat to subscribe to
 * orchestrator progress directly via the AI SDK's processUIMessageStream.
 *
 * sendMessages is a stub — chat input is not wired up in this iteration.
 */

import type { UIMessage, UIMessageChunk } from 'ai';
import type { ChatTransport } from 'ai/ui';

/**
 * Parses a raw SSE ReadableStream into a ReadableStream of UIMessageChunk objects.
 *
 * Lines beginning with ": " are SSE comments (e.g., keep-alive) and are skipped.
 * Lines beginning with "data: " are decoded as JSON UIMessageChunks.
 * The special "data: [DONE]" sentinel is treated as end-of-stream.
 *
 * @param body - The raw byte stream from the SSE response
 * @returns A ReadableStream of parsed UIMessageChunk objects
 */
function parseSseStream(
  body: ReadableStream<Uint8Array>,
): ReadableStream<UIMessageChunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();

  return new ReadableStream<UIMessageChunk>({
    async pull(controller) {
      let buffer = '';

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep the last (potentially incomplete) line in the buffer
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();

          // SSE comment — keep-alive or other metadata, skip
          if (trimmed.startsWith(':')) continue;

          // End of stream sentinel
          if (trimmed === 'data: [DONE]') {
            controller.close();
            return;
          }

          if (trimmed.startsWith('data: ')) {
            const jsonText = trimmed.slice('data: '.length);
            if (!jsonText) continue;

            try {
              const chunk = JSON.parse(jsonText) as UIMessageChunk;
              controller.enqueue(chunk);
            } catch {
              // Malformed JSON — skip silently
            }
          }
        }
      }
    },

    cancel() {
      reader.cancel();
    },
  });
}

/**
 * Creates a ChatTransport that reads from the /api/stream SSE endpoint for
 * the given filename. The transport is read-only — sendMessages is a stub
 * that immediately closes the stream without making a request.
 *
 * @param filename - The novel filename used as the SSE stream key
 * @returns A ChatTransport<UIMessage> for use with useChat
 */
export function createSSETransport(filename: string): ChatTransport<UIMessage> {
  return {
    /**
     * Stub — chat send is not implemented in this iteration.
     * Returns an immediately closed stream so useChat does not hang.
     */
    sendMessages: async () => {
      return new ReadableStream<UIMessageChunk>({
        start(controller) {
          controller.close();
        },
      });
    },

    /**
     * Opens (or re-opens) the SSE connection for this filename and returns
     * a ReadableStream of UIMessageChunks. On reconnect, the server replays
     * the full chunk history so useChat can reconstruct message state.
     *
     * Returns null if the fetch fails so useChat can handle the error.
     */
    reconnectToStream: async () => {
      const response = await fetch(
        `/api/stream?filename=${encodeURIComponent(filename)}`
      );

      if (!response.ok || !response.body) {
        return null;
      }

      return parseSseStream(response.body);
    },
  };
}
