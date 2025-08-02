"use client";

import { HeaderBar } from "@/components/header-bar";
import { ChatInterface } from "@/components/chat-interface";
import { RightColumn } from "@/components/right-column";
import { useClientStore } from "@/lib/store/client-store";

/**
 * Home page component that displays the main chat interface
 * Shows header bar and chat interface with deliverable mode right column
 */
export default function Home() {
  const { workflowStep } = useClientStore();

  return (
    <div className="h-screen bg-background flex flex-col">
      <HeaderBar />
      <main className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col transition-all duration-300 ease-in-out">
          <div className="flex-1 container mx-auto px-4 py-8 flex flex-col min-h-0">
            <div className="flex-1 min-h-0">
              <ChatInterface />
            </div>
          </div>
        </div>
        <div className={`transition-all duration-300 ease-in-out ${
          (workflowStep && workflowStep.order > 0)
            ? 'translate-x-0 opacity-100 w-3/5' 
            : 'translate-x-full opacity-0 w-0'
        }`}>
          {workflowStep && workflowStep.order > 0 && <RightColumn />}
        </div>
      </main>
    </div>
  );
}
