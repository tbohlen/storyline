import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { readFile } from "fs/promises";
import { join } from "path";
import { createChatTools } from "@/lib/tools/event-tools";
import { readCsv } from "@/lib/services/fileParser";

const ANTHROPIC_MODEL = "claude-sonnet-4-6";

/**
 * Chat API endpoint for post-analysis interactive conversation.
 * Streams responses from Claude with full access to the event timeline tools
 * so the user can query and modify the timeline after analysis completes.
 */
export async function POST(req: Request) {
  try {
    const { messages, filename } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return Response.json({ error: "Messages array is required" }, { status: 400 });
    }

    if (!filename || typeof filename !== "string") {
      return Response.json({ error: "filename is required" }, { status: 400 });
    }

    // Load system prompt from file
    const promptPath = join(process.cwd(), "src/lib/prompts/chat-agent-prompt.txt");
    const systemPrompt = await readFile(promptPath, "utf-8");

    // Optionally load master events CSV
    const masterEventsEnabled = process.env.USE_MASTER_EVENTS === "true";
    let masterEvents: Record<string, string>[] | undefined;
    if (masterEventsEnabled && process.env.MASTER_EVENTS_PATH) {
      try {
        masterEvents = await readCsv(process.env.MASTER_EVENTS_PATH);
      } catch {
        // Non-fatal — continue without master events
      }
    }

    const tools = createChatTools({
      globalStartPosition: 0,
      novelName: filename,
      emitChunk: () => {}, // No SSE stream in chat context; graph refresh handled client-side
      masterEventsEnabled,
      masterEvents,
    });

    const result = streamText({
      model: anthropic(ANTHROPIC_MODEL),
      messages,
      system: systemPrompt,
      tools,
      maxSteps: 10, // Allow multi-step tool use within a single response
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Chat API error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
