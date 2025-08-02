/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import type React from "react"
import { Bot } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Message } from 'ai';

/**
 * AI Message component that displays messages from the AI assistant
 * Uses shadcn/ui Avatar and Card components for consistent styling
 */
interface AIMessageProps {
  /** Message object from useChat hook */
  message: Message;
}

export function AIMessage({ message }: AIMessageProps) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <Avatar className="w-8 h-8 shrink-0">
        <AvatarFallback className="bg-primary text-primary-foreground">
          <Bot className="w-4 h-4" />
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 max-w-4xl">
        <Card className="bg-muted/50">
          <CardContent className="">
            <div className="text-sm text-foreground whitespace-pre-wrap">
              {message.content}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function AIMessageDisplay({ message }: AIMessageProps) {
  if (message.parts && message.parts.length > 1) {
    // this message might have multiple parts separated by step-start
    const components: React.ReactNode[] = [];
    for (let i = 0; i < message.parts.length; i++) {
      if (message.parts[i].type === 'text') {
        // create a ChatMessage component for this part and append it to components
        components.push(
          <AIMessage 
            key={`${message.id}-${i}`}
            message={{ ...message, content: message.parts[i].text, id: `${message.id}-${i}` }}
          />
        );
      } else if (message.parts[i].type === 'tool-invocation'
        && message.parts[i].toolInvocation.state === 'result'
        && message.parts[i].toolInvocation.toolName === 'setDeliverable') {
        // in future, display a tool use notification
      }
    }
    return components
  }

  return (
    <AIMessage message={message} />
  );
}
/* eslint-enable @typescript-eslint/ban-ts-comment */