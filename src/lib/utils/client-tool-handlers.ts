import { Deliverable } from '../types/deliverable';
import { Annotation } from '../types/annotation';
import { DeliverableToolCall } from '../tools/deliverable-tools';
import { StakeholderToolCall } from '../tools/stakeholder-tools';
import { WorkflowStepToolCall } from '../tools/workflow-step-tools';
import { AnnotationToolCall } from '../tools/annotation-tools';
import { workflowSteps } from '../workflow-steps';
import { WorkflowStep } from '../types/workflow-step';

interface DeliverableToolHandlerDependencies {
  setDeliverable: (deliverable: Deliverable) => void;
  setStakeholders: (stakeholders: string) => void;
  setGoals: (goals: string) => void;
  setQuestions: (questions: string[]) => void;
  setWorkflowStep: (workflowStep: WorkflowStep | null) => void;
  setAnnotations: (annotations: Annotation[]) => void;
}

/**
 * This is the file for FRONTEND tool handlers.
 * As each tool request is made by the AI, this system will update the frontend
 * data store with the latest values. This is a somewhat crude way to keep it in
 * sync with the backend, but works well for a quick prototype.
 */
export function createToolHandlers({ 
  setDeliverable, 
  setStakeholders,
  setGoals,
  setQuestions,
  setWorkflowStep,
  setAnnotations
}: DeliverableToolHandlerDependencies) {
  return {
    setDeliverable: (toolCall: DeliverableToolCall) => {
      if (toolCall.toolName === 'setDeliverable') {
        // This is very messy. Would be much cleaner to accept through a backend API.
        const deliverable: Deliverable = {
          title: toolCall.args.title,
          content: toolCall.args.content,
          sessionId: '', // Will be set by the backend
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        setDeliverable(deliverable);
      }
    },
    setStakeholders: (toolCall: StakeholderToolCall) => {
      if (toolCall.toolName === 'setStakeholders') {
        setStakeholders(toolCall.args.stakeholders);
      }
    },
    setGoals: (toolCall: StakeholderToolCall) => {
      if (toolCall.toolName === 'setGoals') {
        setGoals(toolCall.args.goals);
      }
    },
    setQuestions: (toolCall: StakeholderToolCall) => {
      if (toolCall.toolName === 'setQuestions') {
        setQuestions(toolCall.args.questions);
      }
    },
    setWorkflowStep: (toolCall: WorkflowStepToolCall) => {
      if (toolCall.toolName === 'setWorkflowStep') {
        const workflowStep = workflowSteps.find(step => step.order === toolCall.args.stepOrder);
        setWorkflowStep(workflowStep || null);
      }
    },
    setAnnotations: (toolCall: AnnotationToolCall) => {
      if (toolCall.toolName === 'setAnnotations') {
        setAnnotations(toolCall.args.annotations);
      }
    },
    clearAnnotations: (toolCall: AnnotationToolCall) => {
      if (toolCall.toolName === 'clearAnnotations') {
        setAnnotations([]);
      }
    }
  };
}