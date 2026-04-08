"use client";

import { useCallback, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage, TextUIPart, ReasoningUIPart, ChatOnFinishCallback } from "ai";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  ConversationEmptyState,
} from "@/components/ai-elements/conversation";
import {
  Message as MessageComponent,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ai-elements/reasoning";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import ToolRenderer from "@/components/tool-renderer";
import { useGraphStore } from "@/lib/store/graph-store";
import type { StorylineMessagePart } from "@/lib/utils/message-helpers";

interface ChatPanelProps {
  filename: string;
}

// Tool names that write to the database and therefore require a graph refresh
const WRITE_TOOL_NAMES = new Set([
  "tool-create_event",
  "tool-create_relationship",
  "tool-update_event",
]);

/**
 * Interactive chat panel shown after analysis completes.
 * Uses the same ai-elements components as OrchestratorObserver for visual
 * consistency, and triggers a graph refresh whenever the agent calls a
 * write tool (create_event, create_relationship, update_event).
 */
export function ChatPanel({ filename }: ChatPanelProps) {
  const fetchGraph = useGraphStore((s) => s.fetchGraph);

  const handleFinish = useCallback<ChatOnFinishCallback<UIMessage>>(
    ({ message }) => {
      const hasWriteToolCall = message.parts.some(
        (p) =>
          WRITE_TOOL_NAMES.has(p.type) &&
          (p as Extract<StorylineMessagePart, { type: `tool-${string}` }>)
            .state === "output-available"
      );
      if (hasWriteToolCall) {
        fetchGraph(filename);
      }
    },
    [fetchGraph, filename]
  );

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat", body: { filename } }),
    [filename]
  );

  const { messages, sendMessage, status } = useChat({
    transport,
    onFinish: handleFinish,
  });

  const isLoading = status === "submitted" || status === "streaming";

  return (
    <div className="flex flex-col h-full min-h-0">
      <Conversation>
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState>
              <div className="text-center max-w-sm px-4">
                <p className="font-medium text-foreground mb-1">
                  Timeline analysis complete
                </p>
                <p className="text-sm text-muted-foreground">
                  Ask questions about the timeline, request corrections, or
                  explore what might be happening elsewhere in the story world
                  at a given moment.
                </p>
              </div>
            </ConversationEmptyState>
          ) : (
            messages.map((message) => (
              <ChatMessageRenderer key={message.id} message={message} />
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="shrink-0 p-3 border-t border-border bg-background">
        <PromptInput
          onSubmit={({ text }) => {
            if (text.trim()) {
              sendMessage({ text });
            }
          }}
        >
          <PromptInputTextarea
            placeholder="Ask about the timeline…"
            disabled={isLoading}
          />
          <PromptInputFooter>
            <PromptInputSubmit status={status} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}

/**
 * Renders a single chat message with all its parts.
 */
function ChatMessageRenderer({ message }: { message: UIMessage }) {
  return (
    <MessageComponent from={message.role}>
      <MessageContent>
        {message.parts.map((part, index) => (
          <ChatPartRenderer
            key={index}
            part={part as StorylineMessagePart}
          />
        ))}
      </MessageContent>
    </MessageComponent>
  );
}

type ToolPart = Extract<StorylineMessagePart, { type: `tool-${string}` }>;

/**
 * Renders a single message part from the chat stream.
 */
function ChatPartRenderer({ part }: { part: StorylineMessagePart }) {
  switch (part.type.split("-")[0]) {
    case "text":
      return <MessageResponse>{(part as TextUIPart).text}</MessageResponse>;

    case "reasoning":
      return (
        <Reasoning isStreaming={false}>
          <ReasoningTrigger />
          <ReasoningContent>{(part as ReasoningUIPart).text}</ReasoningContent>
        </Reasoning>
      );

    case "tool":
      return <ToolRenderer part={part as ToolPart} />;

    default:
      return null;
  }
}
