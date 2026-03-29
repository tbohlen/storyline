"use client";

import { useEffect, useState } from 'react';
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
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StorylineMessagePart } from '@/lib/utils/message-helpers';
import { createSSETransport } from '@/lib/transport/sse-transport';
import ToolRenderer from './tool-renderer';
import { AnalysisProgressBar, type ProgressState } from './analysis-progress-bar';
import { Shimmer } from '@/components/ai-elements/shimmer';

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
  const [transport] = useState(() => createSSETransport(filename));

  const { messages, error } = useChat({ transport, resume: true });

  // Maintained via useEffect so we only inspect the most-recently-appended parts
  // rather than re-scanning the full message history on every render.
  const [progressState, setProgressState] = useState<ProgressState>({ phase: 'idle', current: 0, total: 0 });
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;
    for (let i = lastMessage.parts.length - 1; i >= 0; i--) {
      const part = lastMessage.parts[i] as StorylineMessagePart;
      if (part.type !== 'data-status') continue;
      const d = (part as DataPart).data;
      setIsAnalyzing(d?.status === 'analyzing');
      if (d?.status === 'completed' && !d?.phase) {
        setProgressState({ phase: 'complete', current: 0, total: 0 });
      } else if (d?.phase === 'event-detection' && typeof d?.totalChunks === 'number') {
        setProgressState({
          phase: 'event-detection',
          current: (d.chunkNumber as number) ?? 0,
          total: d.totalChunks as number,
        });
      } else if (d?.phase === 'timeline-resolution' && typeof d?.totalBatches === 'number') {
        setProgressState({
          phase: 'timeline-resolution',
          current: (d.batchNumber as number) ?? 0,
          total: d.totalBatches as number,
        });
      }
      break;
    }
  }, [messages]);

  return (
    <div className={cn("h-full flex flex-col bg-muted/40", className)}>
      <div className="px-4 py-3 flex items-center justify-between gap-8 overflow-hidden border-b border-border">
        <span className="text-lg font-medium text-ellipsis whitespace-nowrap shrink overflow-hidden">Chat {filename}</span>
      </div>

      <AnalysisProgressBar progressState={progressState} isAnalyzing={isAnalyzing} />

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
          {messages.map((message, index) => (
            <MessageRenderer
              key={message.id}
              message={message}
              isLast={index === messages.length - 1}
              isAnalyzing={isAnalyzing}
            />
          ))}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
    </div>
  );
}

// Extract only tool parts from StorylineMessagePart
type ToolPart = Extract<StorylineMessagePart, { type: `tool-${string}` }>;

// Extract only data parts from StorylineMessagePart
type DataPart = Extract<StorylineMessagePart, { type: `data-${string}` }>;

/**
 * Render individual messages with parts.
 * Passes shimmer flag only to the last data-status part in the last message
 * so the "Analyzing…" shimmer appears only on the most recent status.
 */
function MessageRenderer({ message, isLast, isAnalyzing }: { message: UIMessage; isLast: boolean; isAnalyzing: boolean }) {
  // Find the index of the last data-* part so we can show the shimmer on it
  const lastDataIndex = isLast
    ? message.parts.reduce((acc, p, i) => (p.type.startsWith('data-') ? i : acc), -1)
    : -1;

  return (
    <MessageComponent from={message.role}>
      <MessageContent>
        {message.parts.map((part, index: number) => (
          <PartRenderer
            key={index}
            part={part as StorylineMessagePart}
            showShimmer={isAnalyzing && index === lastDataIndex}
          />
        ))}
      </MessageContent>
    </MessageComponent>
  );
}

/**
 * Renderer for individual message parts
 */
function PartRenderer({ part, showShimmer }: { part: StorylineMessagePart; showShimmer: boolean }) {
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
      return <EventStatusRenderer part={part as DataPart} showShimmer={showShimmer} />;

    case 'tool':
        return <ToolRenderer part={part as ToolPart} />;

    default:
      return null;
  }
}

/**
 * Custom component for event status messages.
 * When showShimmer is true, renders an animated shimmer below the status text
 * to indicate the AI is actively working.
 */
function EventStatusRenderer({ part, showShimmer }: { part: DataPart; showShimmer: boolean }) {
  const status = part.data?.status || 'processing';
  const text = part.data?.text || '';

  return (
    <div className="italic text-gray-500">
      {status !== 'analyzing' && (
        <span className="text-sm capitalize">{status.replace("_", " ")}: </span>
      )}
      <span>{text}</span>
      {showShimmer && status === 'analyzing' && (
        <div className="mt-2 pl-3 border-l-2 border-primary/40 not-italic">
          <Shimmer as="span" duration={1.5} className="text-sm font-medium">
            Analyzing…
          </Shimmer>
        </div>
      )}
    </div>
  );
}
