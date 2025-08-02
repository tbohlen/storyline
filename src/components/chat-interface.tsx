/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
"use client";

import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { ChatInterfaceEmptyState } from "./chat-interface-empty-state";
import { ChatInputBar } from "./chat-input-bar";
import { ChatMessageDisplayer } from "./chat-message-displayer";
import { useClientStore } from "@/lib/store/client-store";
import { createToolHandlers } from "@/lib/utils/client-tool-handlers";
import { DeliverableToolCall } from "@/lib/tools/deliverable-tools";
import { StakeholderToolCall } from "@/lib/tools/stakeholder-tools";
import { WorkflowStepToolCall } from "@/lib/tools/workflow-step-tools";
import { AnnotationToolCall } from "@/lib/tools/annotation-tools";

/**
 * Main chat interface component that handles the chat conversation flow
 * Uses useChat hook for AI chat functionality and manages message state
 */
export function ChatInterface() {
  const { 
    setSessionId, 
    setDeliverable, 
    setStakeholders,
    setGoals,
    setQuestions,
    setWorkflowStep,
    setAnnotations
  } = useClientStore();
  
  // Generate a stable sessionId for this chat session
  const sessionId = useMemo(() => uuidv4(), []);
  
  // Ref for scrolling to bottom
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Set the sessionId in the store
  useEffect(() => {
    setSessionId(sessionId);
  }, [setSessionId, sessionId]);

  // Create extensible tool handlers
  const toolHandlers = useMemo(() => ({
    ...createToolHandlers({ 
      setDeliverable, 
      setStakeholders,
      setGoals,
      setQuestions,
      setWorkflowStep,
      setAnnotations
    }),
  }), [setDeliverable, setStakeholders, setGoals, setQuestions, setWorkflowStep, setAnnotations]);

  const handleToolCall = useCallback(({toolCall}: {toolCall: DeliverableToolCall | StakeholderToolCall | WorkflowStepToolCall | AnnotationToolCall}) => {
    const handler = toolHandlers[toolCall.toolName];
    if (handler) {
      handler(toolCall);
    }
  }, [toolHandlers]);

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/chat",
    body: {
      sessionId,
    },
    onToolCall: handleToolCall,
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto min-h-0">
        {messages.length === 0 ? (
          <ChatInterfaceEmptyState />
        ) : (
          <div className="p-4">
            {messages.map((message) => (
              <ChatMessageDisplayer key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      <div className="p-4 border-t bg-background shrink-0">
        <ChatInputBar
          value={input}
          onChange={handleInputChange}
          onSubmit={handleSubmit}
          disabled={isLoading}
          placeholder="Type your message..."
        />
      </div>
    </div>
  );
}
/* eslint-enable @typescript-eslint/ban-ts-comment */