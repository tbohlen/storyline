import { z } from 'zod';
import { tool, ToolCallUnion, ToolResultUnion } from 'ai';
import { ServerStore } from '../server-store';

export function createStakeholderTools(sessionId: string) {
  const tools = {
    setStakeholders: tool({
      description: 'Set stakeholder information for the current session. This information will be displayed to the user.',
      parameters: z.object({
        stakeholders: z.string().max(200, 'Stakeholder information must be 200 characters or less').describe('Information about the stakeholders who will review this deliverable'),
      }),
      execute: async ({ stakeholders }) => {
        try {
          const serverStore = ServerStore.getInstance();
          serverStore.setValue(sessionId, 'stakeholders', stakeholders);
          return {
            success: true,
            message: 'Stakeholder information updated successfully',
            stakeholders,
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to set stakeholder information: ${error}`,
          };
        }
      },
    }),

    getStakeholders: tool({
      description: 'Get stakeholder information for the current session',
      parameters: z.object({}),
      execute: async () => {
        try {
          const serverStore = ServerStore.getInstance();
          const stakeholders = serverStore.getValue(sessionId, 'stakeholders');
          return {
            success: true,
            message: stakeholders ? 'Stakeholder information retrieved successfully' : 'No stakeholder information found',
            stakeholders: stakeholders || null,
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to get stakeholder information: ${error}`,
          };
        }
      },
    }),

    setGoals: tool({
      description: 'Set stakeholder goals for the current session. This will be displayed to the user.',
      parameters: z.object({
        goals: z.string().max(200, 'Goals information must be 200 characters or less').describe('Information about what the stakeholders hope to achieve or learn'),
      }),
      execute: async ({ goals }) => {
        try {
          const serverStore = ServerStore.getInstance();
          serverStore.setValue(sessionId, 'goals', goals);
          return {
            success: true,
            message: 'Stakeholder goals updated successfully',
            goals,
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to set stakeholder goals: ${error}`,
          };
        }
      },
    }),

    getGoals: tool({
      description: 'Get stakeholder goals for the current session',
      parameters: z.object({}),
      execute: async () => {
        try {
          const serverStore = ServerStore.getInstance();
          const goals = serverStore.getValue(sessionId, 'goals');
          return {
            success: true,
            message: goals ? 'Stakeholder goals retrieved successfully' : 'No stakeholder goals found',
            goals: goals || null,
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to get stakeholder goals: ${error}`,
          };
        }
      },
    }),

    setQuestions: tool({
      description: 'Set anticipated questions from stakeholders for the current session. This will be displayed to the user and used as practice questions for them.',
      parameters: z.object({
        questions: z.array(z.string().max(200, 'Each question must be 200 characters or less')).describe('Array of questions stakeholders might ask about the deliverable'),
      }),
      execute: async ({ questions }) => {
        try {
          const serverStore = ServerStore.getInstance();
          serverStore.setValue(sessionId, 'questions', questions);
          return {
            success: true,
            message: 'Questions updated successfully',
            questions,
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to set questions: ${error}`,
          };
        }
      },
    }),

    getQuestions: tool({
      description: 'Get anticipated questions from stakeholders for the current session',
      parameters: z.object({}),
      execute: async () => {
        try {
          const serverStore = ServerStore.getInstance();
          const questions = serverStore.getValue(sessionId, 'questions');
          return {
            success: true,
            message: questions ? 'Questions retrieved successfully' : 'No questions found',
            questions: questions || [],
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to get questions: ${error}`,
          };
        }
      },
    }),
  };
  
  return tools;
}

// Export proper types for the tools
export type StakeholderTools = ReturnType<typeof createStakeholderTools>;
export type StakeholderToolCall = ToolCallUnion<StakeholderTools>;
export type StakeholderToolResult = ToolResultUnion<StakeholderTools>;