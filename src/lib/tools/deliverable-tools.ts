import { z } from 'zod';
import { tool, ToolCallUnion, ToolResultUnion } from 'ai';
import { ServerStore } from '../server-store';

export function createDeliverableTools(sessionId: string) {
  const tools = {
    setDeliverable: tool({
      description: 'Set or update the deliverable for the current session',
      parameters: z.object({
        title: z.string().describe('The title of the deliverable'),
        content: z.string().describe('The plain text content of the deliverable'),
      }),
      execute: async ({ title, content }) => {
        try {
          const serverStore = ServerStore.getInstance();
          const deliverable = serverStore.setDeliverable(sessionId, title, content);
          return {
            success: true,
            message: 'Deliverable updated successfully',
            deliverable,
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to set deliverable: ${error}`,
          };
        }
      },
    }),

    getDeliverable: tool({
      description: 'Get the current deliverable for the session',
      parameters: z.object({}),
      execute: async () => {
        try {
          const serverStore = ServerStore.getInstance();
          const deliverable = serverStore.getDeliverable(sessionId);
          if (deliverable) {
            return {
              success: true,
              message: 'Deliverable retrieved successfully',
              deliverable,
            };
          } else {
            return {
              success: true,
              message: 'No deliverable found for this session',
            };
          }
        } catch (error) {
          return {
            success: false,
            message: `Failed to get deliverable: ${error}`,
          };
        }
      },
    }),

  };
  
  return tools;
}

// Export proper types for the tools
export type DeliverableTools = ReturnType<typeof createDeliverableTools>;
export type DeliverableToolCall = ToolCallUnion<DeliverableTools>;
export type DeliverableToolResult = ToolResultUnion<DeliverableTools>;