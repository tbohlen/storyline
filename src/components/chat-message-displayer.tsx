import { AIMessageDisplay } from "./ai-message";
import { HumanMessage } from "./human-message";
import { EventMessage, EventMessageData } from "./event-message";

/**
 * Message object from Vercel AI SDK useChat hook
 */
interface UIMessage {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'data';
  createdAt?: Date;
  content: string; // CONTENT PROP DEPRECATED! USE IMPORTED TYPE INSTEAD
}

/**
 * Chat Message Displayer component that handles displaying a single message
 * Determines the appropriate message component based on the message role
 *
 * Supports:
 * - user: Human messages (chat interface)
 * - assistant: AI messages (chat interface)
 * - data: Event messages (orchestrator/agent events)
 * - system: Hidden system messages
 */
interface ChatMessageDisplayerProps {
  /** Message object from useChat hook or event stream */
  message: UIMessage | EventMessageData;
}

/**
 * Type guard to check if message is an EventMessageData
 */
function isEventMessage(message: UIMessage | EventMessageData): message is EventMessageData {
  return 'agent' in message && 'type' in message;
}

export function ChatMessageDisplayer({ message }: ChatMessageDisplayerProps) {
  // Check if this is an event message from orchestrator/agents
  if (isEventMessage(message)) {
    return <EventMessage message={message} />;
  }

  // Handle chat messages by role
  switch (message.role) {
    case 'user':
      // Human chat messages (for future chat interface)
      return <HumanMessage message={message} />;

    case 'assistant':
      // AI assistant chat messages (for future chat interface)
      return <AIMessageDisplay message={message} />;

    case 'system':
      // System messages are typically not displayed to users
      return null;

    case 'data':
      // Data messages - could be event messages or other structured data
      // For now, try parsing as event message
      try {
        const eventData = JSON.parse(message.content) as EventMessageData;
        if (eventData.agent && eventData.type) {
          return <EventMessage message={eventData} />;
        }
      } catch {
        // Not a valid event message, fall through to default
      }
      return null;

    default:
      // Fallback for unknown message types
      console.warn('Unknown message role:', (message as UIMessage).role);
      return null;
  }
}