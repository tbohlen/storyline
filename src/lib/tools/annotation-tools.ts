import { z } from 'zod';
import { tool, ToolCallUnion, ToolResultUnion } from 'ai';
import { Annotation } from '../types/annotation';
import { ServerStore } from '../server-store';

/**
 * Helper functions for managing annotations
 */
function getAnnotationsFromStore(sessionId: string): Annotation[] {
  const store = ServerStore.getInstance();
  const annotations = store.getValue(sessionId, 'annotations');
  return annotations || [];
}

function setAnnotationsInStore(sessionId: string, annotations: Annotation[]): Annotation[] {
  const store = ServerStore.getInstance();
  store.setValue(sessionId, 'annotations', annotations);
  return annotations;
}

export function createAnnotationTools(sessionId: string) {
  const tools = {
    getAnnotations: tool({
      description: 'Get all annotations for the current session',
      parameters: z.object({}),
      execute: async () => {
        try {
          const annotations = getAnnotationsFromStore(sessionId);
          return {
            success: true,
            message: 'Annotations retrieved successfully',
            annotations,
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to get annotations: ${error}`,
          };
        }
      },
    }),

    setAnnotations: tool({
      description: 'Set/update all annotations for the current session',
      parameters: z.object({
        annotations: z.array(z.object({
          id: z.string().describe('Unique identifier for the annotation'),
          firstCharacter: z.number().describe('Character position where annotation starts'),
          lastCharacter: z.number().describe('Character position where annotation ends'),
          title: z.string().describe('Title of the annotation'),
          description: z.string().describe('Description explaining the decision or critical information'),
        })).describe('Array of annotations to save'),
      }),
      execute: async ({ annotations }) => {
        try {
          const savedAnnotations = setAnnotationsInStore(sessionId, annotations);
          return {
            success: true,
            message: 'Annotations updated successfully',
            annotations: savedAnnotations,
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to set annotations: ${error}`,
          };
        }
      },
    }),

    clearAnnotations: tool({
      description: 'Clear all annotations for the current session',
      parameters: z.object({}),
      execute: async () => {
        try {
          const clearedAnnotations = setAnnotationsInStore(sessionId, []);
          return {
            success: true,
            message: 'All annotations cleared successfully',
            annotations: clearedAnnotations,
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to clear annotations: ${error}`,
          };
        }
      },
    }),
  };
  
  return tools;
}

// Export proper types for the tools
export type AnnotationTools = ReturnType<typeof createAnnotationTools>;
export type AnnotationToolCall = ToolCallUnion<AnnotationTools>;
export type AnnotationToolResult = ToolResultUnion<AnnotationTools>;