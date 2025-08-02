/**
 * TypeScript interfaces for Workflow Steps.
 */

export interface WorkflowStep {
  order: number;
  title: string;
  humanDescription: string;
  aiDescription: string;
  aiPrompt: string;
}