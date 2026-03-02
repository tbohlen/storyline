import { User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Message object from Vercel AI SDK useChat hook
 */
interface UIMessage {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'data';
  createdAt?: Date;
  content: string; // DEPRECATED. USE IMPORTED TYPES INSTEAD
}

/**
 * Human Message component that displays messages from the user
 * Uses shadcn/ui Avatar and Card components for consistent styling
 * Aligns to the right side to distinguish from AI messages
 */
interface HumanMessageProps {
  /** Message object from useChat hook */
  message: UIMessage;
}

export function HumanMessage({ message }: HumanMessageProps) {
  return (
    <div className="flex items-start gap-3 mb-4 justify-end">
      <div className="flex-1 max-w-4xl">
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="">
            <div className="text-sm whitespace-pre-wrap">
              CONTENT PROP DEPRECATED FIX! {message.content}
            </div>
          </CardContent>
        </Card>
      </div>
      <Avatar className="w-8 h-8 shrink-0">
        <AvatarFallback className="bg-secondary text-secondary-foreground">
          <User className="w-4 h-4" />
        </AvatarFallback>
      </Avatar>
    </div>
  );
}