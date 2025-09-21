import pino from 'pino';
import { logPrompt, logResponse } from './agentLogger';

const logger = pino();

export interface EventDetectionResponse {
  eventFound: boolean;
  quote: string;
  charRangeStart: number;
  charRangeEnd: number;
  eventType: string;
  significance: string;
}

export interface DateAssignmentResponse {
  dateFound: boolean;
  absoluteDate: string;
  confidence: string;
  sourceText: string;
}

export interface RelationshipData {
  type: string;
  targetEvent: string;
  sourceText: string;
  confidence: string;
}

export interface RelationshipAssignmentResponse {
  relationshipsFound: RelationshipData[];
}

export interface GenericResponse {
  message: string;
  processed: boolean;
}

export type LLMResponse = EventDetectionResponse | DateAssignmentResponse | RelationshipAssignmentResponse | GenericResponse;

export async function generate(prompt: string, agentName: string = 'UnknownAgent'): Promise<LLMResponse> {
  logger.info(`LLM Service called by ${agentName} with prompt: ${prompt.substring(0, 100)}...`);

  // Log the prompt
  logPrompt(agentName, prompt);

  // Mock responses based on agent type for development
  const mockResponses: Record<string, LLMResponse> = {
    EventDetectionAgent: {
      eventFound: true,
      quote: "The ancient sword gleamed in the moonlight as Sir Galahad drew it from the stone.",
      charRangeStart: 1247,
      charRangeEnd: 1315,
      eventType: "discovery",
      significance: "high"
    } as EventDetectionResponse,
    DateAssignmentAgent: {
      dateFound: true,
      absoluteDate: "1188-04-15",
      confidence: "high",
      sourceText: "on the fifteenth day of April, in the year of our Lord eleven hundred and eighty-eight"
    } as DateAssignmentResponse,
    RelationshipAssignmentAgent: {
      relationshipsFound: [
        {
          type: "BEFORE",
          targetEvent: "The coronation of King Arthur",
          sourceText: "This happened before the great coronation ceremony",
          confidence: "medium"
        }
      ]
    } as RelationshipAssignmentResponse
  };

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));

  const response: LLMResponse = mockResponses[agentName] || {
    message: "Generic LLM response",
    processed: true
  } as GenericResponse;

  // Log the response
  logResponse(agentName, response);

  logger.info(`LLM Service response for ${agentName}: ${JSON.stringify(response)}`);;
  return response;
}