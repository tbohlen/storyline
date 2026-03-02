"use client"

import { useSearchParams } from 'next/navigation';
import { OrchestratorObserver } from '@/components/orchestrator-observer';
import { GraphVisualization } from '@/components/graph-visualization';
import { Suspense } from 'react';

/**
 * Observer page component that displays real-time orchestrator progress
 * Connects to SSE stream based on filename parameter
 */
function ObserverContent() {
  const searchParams = useSearchParams();
  const filename = searchParams.get('filename');

  if (!filename) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">No File Specified</h1>
          <p className="text-muted-foreground">
            Please start an analysis from the home page to view progress here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">S</span>
            </div>
            <div>
              <h1 className="text-xl font-bold">Timeline Analysis Observer</h1>
              <p className="text-sm text-muted-foreground">
                Real-time analysis progress and agent interactions
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Two Panel Layout */}
      <main className="flex-1 flex min-h-0 w-full">
        {/* Graph Panel: 70% */}
        <div className="flex-[7] min-w-0">
          <GraphVisualization filename={filename} className="h-full" />
        </div>

        {/* Observer Panel: 30%, separated by a 1px border */}
        <div className="flex-[3] min-w-0 border-l border-border">
          <OrchestratorObserver filename={filename} className="h-full" />
        </div>
      </main>
    </div>
  );
}

export default function ObserverPage() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading observer...</p>
        </div>
      </div>
    }>
      <ObserverContent />
    </Suspense>
  );
}
