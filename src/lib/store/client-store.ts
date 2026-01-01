import { create } from 'zustand';

interface ClientStore {
  sessionId: string | null;
  stakeholders: string | null;
  goals: string | null;
  questions: string[] | null;
  
  // Actions
  setSessionId: (sessionId: string) => void;
  setStakeholders: (stakeholders: string) => void;
  setGoals: (goals: string) => void;
  setQuestions: (questions: string[]) => void;
}

export const useClientStore = create<ClientStore>((set) => ({
  sessionId: null,
  stakeholders: null,
  goals: null,
  questions: null,
  
  setSessionId: (sessionId) => set({ sessionId }),
  setStakeholders: (stakeholders) => set({ stakeholders }),
  setGoals: (goals) => set({ goals }),
  setQuestions: (questions) => set({ questions }),
}));