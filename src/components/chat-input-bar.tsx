import { Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Chat input bar component that handles message input and submission
 * Combines input field with send button for chat interface
 */
interface ChatInputBarProps {
  /** Current input value */
  value: string;
  /** Function to handle input value changes */
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Function to handle message submission */
  onSubmit: (e: React.FormEvent) => void;
  /** Whether the input is disabled (e.g., while sending) */
  disabled?: boolean;
  /** Placeholder text for the input field */
  placeholder?: string;
}

export function ChatInputBar({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "Type your message..."
}: ChatInputBarProps) {
  return (
    <form onSubmit={onSubmit} className="flex gap-2 items-center">
      <Input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit(e);
          }
        }}
      />
      <Button 
        type="submit" 
        disabled={disabled || !value.trim()}
        size="default"
        className="shrink-0"
      >
        <Send className="h-4 w-4" />
        <span className="sr-only">Send message</span>
      </Button>
    </form>
  );
}