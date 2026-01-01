import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";

/**
 * Chat API endpoint that streams responses from Anthropic Claude
 * Handles POST requests with messages and sessionId, returns streaming text responses
 */
export async function POST(req: Request) {
  try {
    const { messages, sessionId } = await req.json();

    // Validate that messages exist and is an array
    if (!messages || !Array.isArray(messages)) {
      return Response.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    // Validate that sessionId exists
    if (!sessionId || typeof sessionId !== 'string') {
      return Response.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    // generate the system prompt based on the current workflow step
    const prompt = "Help the user."

    // Stream the response from Anthropic Claude
    const result = await streamText({
      model: anthropic("claude-3-5-sonnet-20241022"),
      messages,
      system: prompt,
      tools: {},
      maxSteps: 10
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("Chat API error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}