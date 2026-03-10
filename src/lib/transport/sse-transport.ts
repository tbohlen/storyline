/**
 * SSE Chat Transport
 *
 * Implements the AI SDK ChatTransport interface by reading UIMessageChunks
 * from the /api/stream SSE endpoint. This allows useChat to subscribe to
 * orchestrator progress directly via the AI SDK's processUIMessageStream.
 *
 * sendMessages is a stub — chat input is not wired up in this iteration.
 */

import type { UIMessage, UIMessageChunk, ChatTransport } from 'ai';

/**
 * Parses a raw SSE ReadableStream into a ReadableStream of UIMessageChunk objects.
 *
 * Lines beginning with ": " are SSE comments (e.g., keep-alive) and are skipped.
 * Lines beginning with "data: " are decoded as JSON UIMessageChunks.
 * The special "data: [DONE]" sentinel is treated as end-of-stream.
 *
 * onClose is called when the stream ends for any reason (natural close, [DONE]
 * sentinel, or consumer cancel). The caller uses this to reset connection state
 * so future reconnect attempts are not blocked.
 *
 * @param body - The raw byte stream from the SSE response
 * @param onClose - Callback invoked when the stream terminates for any reason
 * @returns A ReadableStream of parsed UIMessageChunk objects
 */
function parseSseStream(
  body: ReadableStream<Uint8Array>,
  onClose: () => void,
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
          onClose();
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
            onClose();
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
      onClose();
    },
  });
}

/**
 * Creates a ChatTransport that reads from the /api/stream SSE endpoint for
 * the given filename. The transport is read-only — sendMessages is a stub
 * that immediately closes the stream without making a request.
 *
 * Concurrent calls to reconnectToStream (e.g. from React Strict Mode's
 * double-invocation of effects) are deduplicated: the second concurrent call
 * returns null, which the SDK treats as "nothing to resume". The flag resets
 * when the active stream closes, so legitimate future reconnects (e.g. after
 * a dropped connection) are allowed through.
 *
 * @param filename - The novel filename used as the SSE stream key
 * @returns A ChatTransport<UIMessage> for use with useChat
 */
export function createSSETransport(filename: string): ChatTransport<UIMessage> {
  // True while a stream is open; resets to false when the stream closes
  // so that a future reconnect attempt (after a dropped connection) succeeds.
  let isConnected = false;

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
     * Returns null if a connection is already active (concurrent call guard)
     * or if the fetch fails.
     */
    reconnectToStream: async () => {
      // Block concurrent calls (e.g. React Strict Mode double-invocation).
      // Return null so the SDK's makeRequest bails out without processing
      // a duplicate stream.
      if (isConnected) return null;
      isConnected = true;

      try {
        const response = await fetch(
          `/api/stream?filename=${encodeURIComponent(filename)}`
        );

        if (!response.ok || !response.body) {
          isConnected = false;
          return null;
        }

        return parseSseStream(response.body, () => {
          isConnected = false;
        });
      } catch {
        isConnected = false;
        return null;
      }
    },
  };
}
