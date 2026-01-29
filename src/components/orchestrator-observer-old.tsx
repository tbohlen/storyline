"use client";

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, CheckCircle, AlertTriangle, Bot, Zap, Database, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThinkingData {
  content: string;
}

interface Message {
  agent: string;
  type: "thinking" | "info" | "error" | "success" | "ping";
  message: string;
  timestamp: string;
  filename?: string;
  data?: ThinkingData | unknown;
}

interface OrchestratorObserverProps {
  filename: string;
  className?: string;
}

export function OrchestratorObserver({ filename, className }: OrchestratorObserverProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error' | 'closed'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!filename) {
      setError('No filename provided');
      return;
    }

    // Create SSE connection
    const eventSource = new EventSource(`/api/stream?filename=${encodeURIComponent(filename)}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('SSE connection opened');
      setConnectionStatus('connected');
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const message: Message = JSON.parse(event.data);
        console.log('SSE message received:', message);

        // Filter out keep-alive pings
        if (message.type !== 'ping') {
          setMessages(prev => [...prev, message]);
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

  const getAgentIcon = (agent: string) => {
    switch (agent.toLowerCase()) {
      case 'orchestrator':
        return <Zap className="h-4 w-4" />;
      case 'event-detector':
      case 'eventdetector':
        return <Bot className="h-4 w-4" />;
      case 'database':
        return <Database className="h-4 w-4" />;
      case 'system':
        return <FileText className="h-4 w-4" />;
      default:
        return <Bot className="h-4 w-4" />;
    }
  };

  const getAgentColor = (agent: string) => {
    switch (agent.toLowerCase()) {
      case 'orchestrator':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'event-detector':
      case 'eventdetector':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'database':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'system':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-orange-100 text-orange-800 border-orange-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'error':
        return <AlertTriangle className="h-3 w-3 text-red-500" />;
      case 'success':
      case 'completed':
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'processing':
      case 'analyzing':
        return <Loader2 className="h-3 w-3 animate-spin text-blue-500" />;
      default:
        return null;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString();
    } catch (error) {
      return timestamp;
    }
  };

  return (
    <Card className={cn("h-full flex flex-col", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Analysis Progress</CardTitle>
          <div className="flex items-center space-x-2">
            {connectionStatus === "connecting" && (
              <div className="flex items-center space-x-1">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                <span className="text-sm text-muted-foreground">
                  Connecting...
                </span>
              </div>
            )}
            {connectionStatus === "connected" && (
              <div className="flex items-center space-x-1">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-green-600">Connected</span>
              </div>
            )}
            {connectionStatus === "error" && (
              <div className="flex items-center space-x-1">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-sm text-red-600">Connection Error</span>
              </div>
            )}
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          Processing: <span className="font-mono">{filename}</span>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          </div>
        )}

        <ScrollArea className="h-full">
          <div className="space-y-3 pr-4">
            {messages.length === 0 && connectionStatus === "connected" && (
              <div className="text-center text-muted-foreground py-8">
                <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Waiting for analysis to begin...</p>
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={index}
                className="flex items-start space-x-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
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

                  {/* Special handling for thinking messages */}
                  {message.type === "thinking" &&
                    !!message.data &&
                    typeof message.data === "object" &&
                    "content" in message.data && (
                      <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <div className="flex items-start space-x-2">
                          <Loader2 className="h-4 w-4 animate-spin text-blue-500 mt-0.5 flex-shrink-0" />
                          <div className="text-sm text-blue-900 dark:text-blue-100 whitespace-pre-wrap">
                            {(message.data as ThinkingData).content}
                          </div>
                        </div>
                      </div>
                    )}

                  {/* Regular data display for non-thinking messages */}
                  {message.type !== "thinking" && !!message.data && (
                    <div className="mt-2 p-2 bg-muted rounded text-xs font-mono overflow-x-auto">
                      <pre className="whitespace-pre-wrap">
                        {typeof message.data === "object"
                          ? JSON.stringify(message.data, null, 2)
                          : String(message.data)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}