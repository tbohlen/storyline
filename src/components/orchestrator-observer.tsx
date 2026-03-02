"use client";

import { useState, useEffect, useRef } from 'react';
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
import ToolRenderer from './tool-renderer';

interface OrchestratorObserverProps {
  filename: string;
  className?: string;
}

/**
 * New orchestrator observer using ai-elements components
 * Displays messages from multiple agents (orchestrator, event-detector, timeline-resolver, etc.)
 */
export function OrchestratorObserver({ filename, className }: OrchestratorObserverProps) {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error' | 'closed'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // SSE connection setup
  useEffect(() => {
    if (!filename) {
      setError('No filename provided');
      return;
    }

    const eventSource = new EventSource(`/api/stream?filename=${encodeURIComponent(filename)}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('SSE connection opened');
      setConnectionStatus('connected');
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        console.log("Trying to parse SSE message...");
        const message: UIMessage = JSON.parse(event.data);
        console.log('SSE message received:', message);

        // Filter out ping messages (check role or metadata)
        if (
          message.role !== "system" ||
          message.parts.length > 1 ||
          message.parts[0].type !== "text" ||
          message.parts[0].text !== "Keep-alive ping"
        ) {
          setMessages((prev) => [...prev, message]);
        }
      } catch (error) {
        console.error('Failed to parse SSE message:', error, event.data);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      setConnectionStatus('error');
      setError('Connection to server lost');
    };

    // Cleanup on unmount
    return () => {
      console.log('Cleaning up SSE connection');
      eventSource.close();
      setConnectionStatus('closed');
    };
  }, [filename]);

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
            <span className="text-sm text-red-700 dark:text-red-100">{error}</span>
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
