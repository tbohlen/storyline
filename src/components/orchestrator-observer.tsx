"use client";

import { useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import type { UIMessage, TextUIPart, ReasoningUIPart } from 'ai';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton
} from '@/components/ai-elements/conversation';
import {
  Message as MessageComponent,
  MessageContent,
  MessageResponse
} from '@/components/ai-elements/message';
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent
} from '@/components/ai-elements/reasoning';
import { Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StorylineMessagePart } from '@/lib/utils/message-helpers';
import { createSSETransport } from '@/lib/transport/sse-transport';
import ToolRenderer from './tool-renderer';

interface OrchestratorObserverProps {
  filename: string;
  className?: string;
}

/**
 * Orchestrator observer component.
 * Uses useChat with a custom SSE transport so the AI SDK's
 * processUIMessageStream handles all in-place message assembly.
 * The transport's reconnectToStream is called automatically on mount
 * (resume: true) and replays chunk history from the server.
 */
export function OrchestratorObserver({ filename, className }: OrchestratorObserverProps) {
  const transport = useMemo(() => createSSETransport(filename), [filename]);

  const { messages, status, error } = useChat({ transport, resume: true });

  // Map useChat status to the ConnectionStatusBadge values
  const connectionStatus = mapStatus(status, error);

  return (
    <div className={cn("h-full flex flex-col bg-muted/40", className)}>
      <div className="px-4 py-3 flex items-center justify-between gap-8 overflow-hidden border-b border-border">
        <span className="text-lg font-medium text-ellipsis whitespace-nowrap shrink overflow-hidden">Chat {filename}</span>
        <ConnectionStatusBadge status={connectionStatus} />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg dark:bg-red-950 dark:border-red-800">
          <div className="flex items-center">
            <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />
            <span className="text-sm text-red-700 dark:text-red-100">{error.message}</span>
          </div>
        </div>
      )}

      <Conversation>
        <ConversationContent>
          {messages.length === 0 && connectionStatus === "connected" && (
            <div className="text-center text-muted-foreground py-8">
              <Loader2 className="h-8 w-8 mx-auto mb-2 opacity-50 animate-spin" />
              <p>Waiting for analysis to begin...</p>
            </div>
          )}
          {messages.map((message) => (
            <MessageRenderer key={message.id} message={message} />
          ))}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
    </div>
  );
}

/**
 * Maps useChat status (and error) to the ConnectionStatusBadge display state.
 */
function mapStatus(
  status: string,
  error: Error | undefined,
): 'connecting' | 'connected' | 'error' | 'closed' {
  if (error) return 'error';
  switch (status) {
    case 'streaming': return 'connected';
    case 'submitted': return 'connecting';
    case 'ready':     return 'closed';
    default:          return 'closed';
  }
}

/**
 * Render individual messages with parts
 */
function MessageRenderer({ message }: { message: UIMessage }) {
  return (
    <MessageComponent from={message.role}>
      <MessageContent>
        {/* Render message parts */}
        {message.parts.map((part, index: number) => (
          <PartRenderer key={index} part={part as StorylineMessagePart} />
        ))}
      </MessageContent>
    </MessageComponent>
  );
}

/**
 * Renderer for individual message parts
 */
function PartRenderer({ part }: { part: StorylineMessagePart }) {
  switch (part.type.split("-")[0]) {
    case 'text':
      return <MessageResponse>{(part as TextUIPart).text}</MessageResponse>;

    case 'reasoning':
      return (
        <Reasoning isStreaming={false}>
          <ReasoningTrigger />
          <ReasoningContent>{(part as ReasoningUIPart).text}</ReasoningContent>
        </Reasoning>
      );

    case 'data':
      return <EventStatusRenderer part={part as DataPart} />;

    case 'tool':
        return <ToolRenderer part={part as ToolPart} />;

    default:
      return null;
  }
}

// Extract only tool parts from StorylineMessagePart
type ToolPart = Extract<StorylineMessagePart, { type: `tool-${string}` }>;

// Extract only data parts from StorylineMessagePart
type DataPart = Extract<StorylineMessagePart, { type: `data-${string}` }>;

/**
 * Custom component for event status messages
 */
function EventStatusRenderer({ part }: { part: DataPart }) {
  const status = part.data?.status || 'processing';
  const text = part.data?.text || '';

  return (
    <div className={"italic text-gray-500"}>
      <span className="text-sm capitalize">{status.replace("_", " ")}: </span>
      <span>{text}</span>
    </div>
  );
}

/**
 * Connection status badge
 */
function ConnectionStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'connecting':
      return (
        <div className="flex items-center space-x-1">
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          <span className="text-sm text-muted-foreground">
            Connecting...
          </span>
        </div>
      );

    case 'connected':
      return (
        <div className="flex items-center space-x-1">
          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-green-600 dark:text-green-400">Connected</span>
        </div>
      );

    case 'error':
      return (
        <div className="flex items-center space-x-1">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <span className="text-sm text-red-600 dark:text-red-400">Connection Error</span>
        </div>
      );

    case 'closed':
      return (
        <div className="flex items-center space-x-1">
          <span className="text-sm text-muted-foreground">Disconnected</span>
        </div>
      );

    default:
      return null;
  }
}
