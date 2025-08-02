import { AIMessageDisplay } from "./ai-message";
import { HumanMessage } from "./human-message";

/**
 * Message object from Vercel AI SDK useChat hook
 */
interface UIMessage {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'data';
  createdAt?: Date;
  content: string;
}

/**
 * Chat Message Displayer component that handles displaying a single message
 * Determines the appropriate message component based on the message role
 */
interface ChatMessageDisplayerProps {
  /** Message object from useChat hook */
  message: UIMessage;
}

export function ChatMessageDisplayer({ message }: ChatMessageDisplayerProps) {
  // Handle different message roles
  switch (message.role) {
    case 'user':
      return <HumanMessage message={message} />;
    case 'assistant':
      return <AIMessageDisplay message={message} />;
    case 'system':
      // System messages are typically not displayed to users
      return null;
    case 'data':
      // Data messages are typically not displayed to users
      return null;
    default:
      // Fallback for unknown message types
      console.warn('Unknown message role:', message.role);
      return null;
  }
}