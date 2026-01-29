"use client";

import { useState, useEffect, useRef } from 'react';
import type { UIMessage } from 'ai';
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
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StorylineMessagePart } from '@/lib/utils/message-helpers';

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
    <Card className={cn("h-full flex flex-col", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Analysis Progress</CardTitle>
          <ConnectionStatusBadge status={connectionStatus} />
        </div>
        <div className="text-sm text-muted-foreground">
          Processing: <span className="font-mono">{filename}</span>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-auto">
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
      </CardContent>
    </Card>
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
  switch (part.type) {
    case 'text':
      return <MessageResponse>{part.text}</MessageResponse>;

    case 'reasoning':
      return (
        <Reasoning isStreaming={false}>
          <ReasoningTrigger />
          <ReasoningContent>{part.text}</ReasoningContent>
        </Reasoning>
      );

    case 'data-status':
      return <EventStatusRenderer part={part as DataPart} />;

    default:
      // Handle tool parts dynamically (tool-create_event, tool-find_event, etc.)
      if (part.type.startsWith('tool-')) {
        return <ToolInvocationRenderer part={part as ToolPart} />;
      }
      return null;
  }
}

// Extract only tool parts from StorylineMessagePart
type ToolPart = Extract<StorylineMessagePart, { type: `tool-${string}` }>;

// Extract only data parts from StorylineMessagePart
type DataPart = Extract<StorylineMessagePart, { type: `data-${string}` }>;

/**
 * Custom component for rendering tool invocations
 */
function ToolInvocationRenderer({ part }: { part: ToolPart }) {
  const isComplete = part.state === 'output-available';
  const toolName = part.type.replace('tool-', '');

  return (
    <div className={cn(
      "mt-2 p-3 rounded-lg border",
      isComplete
        ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800"
        : "bg-purple-50 border-purple-200 dark:bg-purple-950 dark:border-purple-800"
    )}>
      <div className="text-sm font-medium mb-1">
        {isComplete ? '✓' : '⚙️'} {toolName}
      </div>
      {part.input && (
        <div className="text-xs font-mono text-muted-foreground">
          {JSON.stringify(part.input, null, 2)}
        </div>
      )}
      {isComplete && part.output && (
        <div className="mt-2 text-xs">
          <div className="font-medium mb-1">Result:</div>
          <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(part.output, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

/**
 * Custom component for event status messages
 */
function EventStatusRenderer({ part }: { part: DataPart }) {
  const status = part.data?.status || 'processing';
  const text = part.data?.text || '';

  const statusStyles: Record<string, string> = {
    'analyzing': 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800',
    'processing': 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800',
    'success': 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800',
    'error': 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800',
    'completed': 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800',
    'event_found': 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800'
  };

  return (
    <div className={cn("mt-2 p-2 rounded border", statusStyles[status] || statusStyles.processing)}>
      <div className="text-sm capitalize">{status.replace('_', ' ')}</div>
      {text && <div className="text-sm mt-1">{text}</div>}
      {part.data && Object.keys(part.data).filter(k => k !== 'status' && k !== 'text').length > 0 && (
        <pre className="mt-1 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(
            Object.fromEntries(
              Object.entries(part.data).filter(([k]) => k !== 'status' && k !== 'text')
            ),
            null,
            2
          )}
        </pre>
      )}
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
