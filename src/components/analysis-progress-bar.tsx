"use client";

import { cn } from "@/lib/utils";

/**
 * Represents the current analysis phase and how far along it is.
 * `idle` means analysis has not started; `complete` means it finished.
 */
export interface ProgressState {
  phase: "event-detection" | "timeline-resolution" | "idle" | "complete";
  current: number;
  total: number;
}

interface AnalysisProgressBarProps {
  progressState: ProgressState;
  isAnalyzing: boolean;
  className?: string;
}

/**
 * Sticky progress bar shown above the message stream during analysis.
 * Displays dual-phase progress (event detection, then timeline resolution)
 * and a shimmer indicator when the AI is actively working.
 */
export function AnalysisProgressBar({
  progressState,
  isAnalyzing,
  className,
}: AnalysisProgressBarProps) {
  const { phase, current, total } = progressState;

  if (phase === "idle") return null;

  if (phase === "complete") {
    return (
      <div className={cn("px-4 py-2 border-b border-border bg-background", className)}>
        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
          ✓ Analysis complete
        </span>
      </div>
    );
  }

  const isEventDetection = phase === "event-detection";
  const label = isEventDetection ? "Phase 1: Event Detection" : "Phase 2: Timeline Resolution";
  const unit = isEventDetection ? "Chunk" : "Batch";
  const percent = total > 0 ? Math.min(Math.round((current / total) * 100), 100) : 0;

  return (
    <div className={cn("px-4 py-2 border-b border-border bg-background space-y-1.5", className)}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium">{label}</span>
        <span>
          {unit} {current} of ~{total}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      {isAnalyzing && (
        <p className="text-xs text-muted-foreground animate-pulse">Analyzing…</p>
      )}
    </div>
  );
}
