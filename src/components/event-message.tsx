import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, CheckCircle, AlertTriangle, Bot, Zap, Database, FileText, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Event message data structure from orchestrator SSE stream
 */
export interface EventMessageData {
  agent: string;
  type: 'thinking' | 'info' | 'error' | 'success' | 'ping' | 'status' | 'analyzing' | 'completed' | 'processing' | 'progress' | 'result' | 'tool_call' | 'tool_result' | 'step' | 'event_found';
  message: string;
  timestamp: string;
  filename?: string;
  data?: {
    content?: string;
    [key: string]: unknown;
  };
}

interface EventMessageProps {
  message: EventMessageData;
}

/**
 * Get icon for agent type
 */
function getAgentIcon(agent: string) {
  switch (agent.toLowerCase()) {
    case 'orchestrator':
      return <Zap className="h-4 w-4" />;
    case 'event-detector':
    case 'eventdetector':
      return <Bot className="h-4 w-4" />;
    case 'timeline-resolver':
    case 'timelineresolver':
      return <FileText className="h-4 w-4" />;
    case 'database':
      return <Database className="h-4 w-4" />;
    case 'system':
      return <FileText className="h-4 w-4" />;
    default:
      return <Bot className="h-4 w-4" />;
  }
}

/**
 * Get color scheme for agent badge
 */
function getAgentColor(agent: string) {
  switch (agent.toLowerCase()) {
    case 'orchestrator':
      return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-100';
    case 'event-detector':
    case 'eventdetector':
      return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-100';
    case 'timeline-resolver':
    case 'timelineresolver':
      return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900 dark:text-amber-100';
    case 'database':
      return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-100';
    case 'system':
      return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-100';
    default:
      return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900 dark:text-orange-100';
  }
}

/**
 * Get icon for message type
 */
function getTypeIcon(type: string) {
  switch (type.toLowerCase()) {
    case 'error':
      return <AlertTriangle className="h-3 w-3 text-red-500" />;
    case 'success':
    case 'completed':
      return <CheckCircle className="h-3 w-3 text-green-500" />;
    case 'processing':
    case 'analyzing':
      return <Loader2 className="h-3 w-3 animate-spin text-blue-500" />;
    case 'info':
    case 'status':
      return <Info className="h-3 w-3 text-blue-500" />;
    default:
      return null;
  }
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: string) {
  try {
    return new Date(timestamp).toLocaleTimeString();
  } catch {
    return timestamp;
  }
}

/**
 * Event Message component - renders different event types from orchestrator
 */
export function EventMessage({ message }: EventMessageProps) {
  // Switch statement to handle different event types
  // This makes it clear which event types the system currently uses
  switch (message.type) {
    case 'thinking':
      return <ThinkingEventMessage message={message} />;

    case 'error':
      return <ErrorEventMessage message={message} />;

    case 'success':
    case 'completed':
      return <SuccessEventMessage message={message} />;

    case 'analyzing':
    case 'processing':
      return <ProcessingEventMessage message={message} />;

    case 'status':
    case 'info':
      return <StatusEventMessage message={message} />;

    case 'progress':
      return <ProgressEventMessage message={message} />;

    case 'result':
      return <ResultEventMessage message={message} />;

    case 'tool_call':
      return <ToolCallEventMessage message={message} />;

    case 'tool_result':
      return <ToolResultEventMessage message={message} />;

    case 'step':
      return <StepEventMessage message={message} />;

    case 'event_found':
      return <EventFoundMessage message={message} />;

    case 'ping':
      // Keep-alive messages are filtered out, but handle gracefully
      return null;

    default:
      // Fallback for any unknown event types
      return <DefaultEventMessage message={message} />;
  }
}

/**
 * Base event message component with common structure
 */
function BaseEventMessage({
  message,
  children,
  className
}: {
  message: EventMessageData;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("mb-3", className)}>
      <CardContent className="p-3">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 mt-0.5">
            {getAgentIcon(message.agent)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <Badge
                variant="outline"
                className={cn("text-xs", getAgentColor(message.agent))}
              >
                {message.agent}
              </Badge>
              {getTypeIcon(message.type)}
              <span className="text-xs text-muted-foreground font-mono">
                {formatTimestamp(message.timestamp)}
              </span>
            </div>

            <div className="text-sm text-foreground">
              {message.message}
            </div>

            {children}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Thinking event - shows AI reasoning
 */
function ThinkingEventMessage({ message }: { message: EventMessageData }) {
  return (
    <BaseEventMessage message={message}>
      {message.data?.content && (
        <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start space-x-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-900 dark:text-blue-100 whitespace-pre-wrap">
              {message.data.content}
            </div>
          </div>
        </div>
      )}
    </BaseEventMessage>
  );
}

/**
 * Error event - shows errors with red styling
 */
function ErrorEventMessage({ message }: { message: EventMessageData }) {
  return (
    <BaseEventMessage message={message} className="border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
      {message.data && (
        <div className="mt-2 p-2 bg-red-100 dark:bg-red-900 rounded text-xs font-mono overflow-x-auto">
          <pre className="whitespace-pre-wrap text-red-900 dark:text-red-100">
            {typeof message.data === 'object' ? JSON.stringify(message.data, null, 2) : String(message.data)}
          </pre>
        </div>
      )}
    </BaseEventMessage>
  );
}

/**
 * Success/Completed event - shows success with green styling
 */
function SuccessEventMessage({ message }: { message: EventMessageData }) {
  return (
    <BaseEventMessage message={message} className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
      {message.data && (
        <div className="mt-2 p-2 bg-muted rounded text-xs font-mono overflow-x-auto">
          <pre className="whitespace-pre-wrap">
            {typeof message.data === 'object' ? JSON.stringify(message.data, null, 2) : String(message.data)}
          </pre>
        </div>
      )}
    </BaseEventMessage>
  );
}

/**
 * Processing/Analyzing event - shows in-progress state
 */
function ProcessingEventMessage({ message }: { message: EventMessageData }) {
  return (
    <BaseEventMessage message={message} className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
      {message.data && (
        <div className="mt-2 p-2 bg-muted rounded text-xs font-mono overflow-x-auto">
          <pre className="whitespace-pre-wrap">
            {typeof message.data === 'object' ? JSON.stringify(message.data, null, 2) : String(message.data)}
          </pre>
        </div>
      )}
    </BaseEventMessage>
  );
}

/**
 * Status/Info event - general informational messages
 */
function StatusEventMessage({ message }: { message: EventMessageData }) {
  return (
    <BaseEventMessage message={message}>
      {message.data && (
        <div className="mt-2 p-2 bg-muted rounded text-xs font-mono overflow-x-auto">
          <pre className="whitespace-pre-wrap">
            {typeof message.data === 'object' ? JSON.stringify(message.data, null, 2) : String(message.data)}
          </pre>
        </div>
      )}
    </BaseEventMessage>
  );
}

/**
 * Progress event - shows progress updates
 */
function ProgressEventMessage({ message }: { message: EventMessageData }) {
  return (
    <BaseEventMessage message={message}>
      {message.data && (
        <div className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
          {typeof message.data === 'object' && 'progress' in message.data && (
            <div className="mb-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${message.data.progress}%` }}
                />
              </div>
            </div>
          )}
          <pre className="whitespace-pre-wrap text-xs font-mono">
            {typeof message.data === 'object' ? JSON.stringify(message.data, null, 2) : String(message.data)}
          </pre>
        </div>
      )}
    </BaseEventMessage>
  );
}

/**
 * Result event - shows results from operations
 */
function ResultEventMessage({ message }: { message: EventMessageData }) {
  return <BaseEventMessage message={message} />;
}

/**
 * Tool call event - shows when AI calls a tool
 */
function ToolCallEventMessage({ message }: { message: EventMessageData }) {
  return (
    <BaseEventMessage message={message} className="border-purple-200 bg-purple-50 dark:bg-purple-950 dark:border-purple-800">
      {message.data && (
        <div className="mt-2 p-2 bg-muted rounded text-xs font-mono overflow-x-auto">
          <pre className="whitespace-pre-wrap">
            {typeof message.data === 'object' ? JSON.stringify(message.data, null, 2) : String(message.data)}
          </pre>
        </div>
      )}
    </BaseEventMessage>
  );
}

/**
 * Tool result event - shows results from tool calls
 */
function ToolResultEventMessage({ message }: { message: EventMessageData }) {
  return <BaseEventMessage message={message} />;
}

/**
 * Step event - shows agent step completions
 */
function StepEventMessage({ message }: { message: EventMessageData }) {
  return <BaseEventMessage message={message} />;
}

/**
 * Event found message - shows when events are detected
 */
function EventFoundMessage({ message }: { message: EventMessageData }) {
  return (
    <BaseEventMessage message={message} className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
      {message.data && (
        <div className="mt-2 p-2 bg-muted rounded text-xs font-mono overflow-x-auto">
          <pre className="whitespace-pre-wrap">
            {typeof message.data === 'object' ? JSON.stringify(message.data, null, 2) : String(message.data)}
          </pre>
        </div>
      )}
    </BaseEventMessage>
  );
}

/**
 * Default event message - fallback for unknown types
 */
function DefaultEventMessage({ message }: { message: EventMessageData }) {
  return (
    <BaseEventMessage message={message}>
      <div className="mt-1 text-xs text-muted-foreground">
        Unknown event type: {message.type}
      </div>
      {message.data && (
        <div className="mt-2 p-2 bg-muted rounded text-xs font-mono overflow-x-auto">
          <pre className="whitespace-pre-wrap">
            {typeof message.data === 'object' ? JSON.stringify(message.data, null, 2) : String(message.data)}
          </pre>
        </div>
      )}
    </BaseEventMessage>
  );
}
