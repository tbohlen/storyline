import { create } from 'zustand';
import { Deliverable } from '../types/deliverable';
import { WorkflowStep } from '../types/workflow-step';
import { Annotation } from '../types/annotation';

interface ClientStore {
  deliverable: Deliverable | null;
  isDeliverableMode: boolean;
  sessionId: string | null;
  stakeholders: string | null;
  goals: string | null;
  questions: string[] | null;
  workflowStep: WorkflowStep | null;
  annotations: Annotation[];
  selectedAnnotation: Annotation | null;
  
  // Actions
  setDeliverable: (deliverable: Deliverable) => void;
  clearDeliverable: () => void;
  setSessionId: (sessionId: string) => void;
  setStakeholders: (stakeholders: string) => void;
  setGoals: (goals: string) => void;
  setQuestions: (questions: string[]) => void;
  setWorkflowStep: (workflowStep: WorkflowStep | null) => void;
  setAnnotations: (annotations: Annotation[]) => void;
  setSelectedAnnotation: (annotation: Annotation | null) => void;
}

export const useClientStore = create<ClientStore>((set) => ({
  deliverable: null,
  isDeliverableMode: false,
  sessionId: null,
  stakeholders: null,
  goals: null,
  questions: null,
  workflowStep: null,
  annotations: [],
  selectedAnnotation: null,
  
  setDeliverable: (deliverable) => set({ deliverable }),
  clearDeliverable: () => set({ deliverable: null }),
  setSessionId: (sessionId) => set({ sessionId }),
  setStakeholders: (stakeholders) => set({ stakeholders }),
  setGoals: (goals) => set({ goals }),
  setQuestions: (questions) => set({ questions }),
  setWorkflowStep: (workflowStep) => set({ workflowStep }),
  setAnnotations: (annotations) => set({ annotations }),
  setSelectedAnnotation: (annotation) => set({ selectedAnnotation: annotation }),
}));