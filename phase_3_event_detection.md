# Phase 3: Event Detection AI Agent

## Objective
Implement an AI agent that reads text chunks sequentially, identifies major events that match the provided CSV reference, and creates event nodes in the graph database with precise text references.

## Technical Requirements

### Additional Dependencies
```json
{
  "dependencies": {
    "openai": "^4.20.1",
    "@anthropic-ai/sdk": "^0.9.1",
    "tiktoken": "^1.0.10",
    "zod": "^3.22.4",
    "p-queue": "^7.4.1",
    "bottleneck": "^2.19.5"
  },
  "devDependencies": {
    "@types/node": "^20.10.0"
  }
}
```

## Core Components to Implement

### 1. Base AI Agent Framework
**File**: `src/agents/base-agent.ts`

Foundation for all AI agents with common functionality:
```typescript
export interface AgentConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface AgentContext {
  novelId: string;
  novelNumber: number;
  chunkId: string;
  chunkNumber: number;
  sessionId?: string;
}

export interface AgentResult<T> {
  success: boolean;
  data?: T;
  confidence: number;
  reasoning?: string;
  tokensUsed: number;
  processingTime: number;
  errors?: string[];
  warnings?: string[];
}

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected llmClient: ILLMProvider;
  protected logger: Logger;
  
  constructor(llmClient: ILLMProvider, config: AgentConfig);
  
  abstract process(input: any, context: AgentContext): Promise<AgentResult<any>>;
  
  protected async makeRequest(
    prompt: string, 
    context: AgentContext,
    schema?: ZodSchema
  ): Promise<AgentResult<any>>;
  
  protected logInteraction(
    type: 'prompt' | 'response',
    content: string,
    context: AgentContext,
    metadata?: any
  ): Promise<void>;
}
```

### 2. LLM Provider Interface
**File**: `src/services/llm-client.ts`

Unified interface for multiple LLM providers:
```typescript
export interface ILLMProvider {
  name: string;
  generateCompletion(prompt: string, options?: LLMOptions): Promise<string>;
  generateStructuredOutput<T>(
    prompt: string, 
    schema: ZodSchema<T>,
    options?: LLMOptions
  ): Promise<T>;
}

export class OpenAIClient implements ILLMProvider {
  name = 'openai';
  private client: OpenAI;
  
  async generateCompletion(prompt: string, options?: LLMOptions): Promise<string>;
  async generateStructuredOutput<T>(
    prompt: string,
    schema: ZodSchema<T>,
    options?: LLMOptions
  ): Promise<T>;
}

export class AnthropicClient implements ILLMProvider {
  name = 'anthropic';
  private client: Anthropic;
  
  async generateCompletion(prompt: string, options?: LLMOptions): Promise<string>;
  async generateStructuredOutput<T>(
    prompt: string,
    schema: ZodSchema<T>, 
    options?: LLMOptions
  ): Promise<T>;
}
```

### 3. Event Detection Agent
**File**: `src/agents/event-detector.ts`

Main event detection logic:
```typescript
export interface EventDetectionInput {
  chunk: ITextChunk;
  eventsReference: EventCSVRow[];
  novelContext: {
    title?: string;
    previousEvents: DetectedEvent[];
  };
}

export interface DetectedEvent {
  eventName: string;
  description: string;
  csvRowId?: string;
  textEvidence: string;
  characterStart: number;
  characterEnd: number;
  confidence: number;
  reasoning: string;
  isNewEvent: boolean;
}

export class EventDetector extends BaseAgent {
  private eventRepository: IEventRepository;
  private eventsReferenceRepo: EventsReferenceRepository;
  
  async process(
    input: EventDetectionInput,
    context: AgentContext
  ): Promise<AgentResult<DetectedEvent[]>>;
  
  private buildDetectionPrompt(
    chunk: ITextChunk,
    eventsReference: EventCSVRow[],
    previousEvents: DetectedEvent[]
  ): string;
  
  private async extractEventsFromResponse(
    response: string,
    chunk: ITextChunk
  ): Promise<DetectedEvent[]>;
  
  private calculateTextPosition(
    evidence: string,
    chunk: ITextChunk
  ): { start: number; end: number };
  
  private async storeDetectedEvent(
    event: DetectedEvent,
    context: AgentContext
  ): Promise<string>;
}
```

### 4. Event Detection Prompts
**File**: `src/agents/prompts/event-detection.ts`

Structured prompts for event detection:
```typescript
export class EventDetectionPrompts {
  static buildMainPrompt(
    chunkText: string,
    eventsReference: EventCSVRow[],
    novelContext: { title?: string; previousEvents: DetectedEvent[] }
  ): string {
    return `
You are an expert literary analyst tasked with identifying major events in a novel.

## Context
Novel: ${novelContext.title || 'Unknown'}
Chunk being analyzed: [Text between triple quotes below]

## Your Task
Analyze the provided text chunk and identify any major events that occur within it. 
Focus on significant plot developments, character actions, or story milestones.

## Reference Events
Here are the major events we expect to find in this novel series:
${eventsReference.map(event => `
- ${event.eventName}: ${event.description}
`).join('')}

## Previously Detected Events
${novelContext.previousEvents.map(event => `
- ${event.eventName} (Confidence: ${event.confidence})
`).join('') || 'None yet detected'}

## Text to Analyze
"""
${chunkText}
"""

## Instructions
1. Carefully read the text chunk
2. Identify any major events that occur in this text
3. For each event found:
   - Match it to a reference event if possible
   - Extract the exact text evidence
   - Determine precise character positions
   - Assess confidence level (0.0-1.0)
   - Provide reasoning for detection

## Output Format
Respond with a JSON array of detected events. Each event should have:
{
  "eventName": "Name of the event",
  "description": "Brief description of what happens",
  "csvRowId": "ID from reference events if matched, null if new",
  "textEvidence": "Exact quote from the text",
  "confidence": 0.95,
  "reasoning": "Why you believe this is a major event",
  "isNewEvent": false
}

## Important Guidelines
- Only identify truly significant events, not minor plot points
- Be precise with text evidence - extract exact quotes
- Confidence should reflect how certain you are this is a major event
- If an event doesn't match the reference list exactly, mark as new event
- Include sufficient context in textEvidence for understanding
`;
  }

  static buildValidationPrompt(
    detectedEvents: DetectedEvent[],
    chunkText: string
  ): string {
    return `
Review these detected events and verify they are correctly identified:

Chunk Text: "${chunkText}"

Detected Events:
${detectedEvents.map((event, i) => `
${i + 1}. ${event.eventName}
   Evidence: "${event.textEvidence}"
   Confidence: ${event.confidence}
`).join('')}

Respond with "VALID" if all events are correctly identified, or "ISSUES" followed by specific problems.
`;
  }
}
```

### 5. Event Processing Orchestrator
**File**: `src/services/event-processing-service.ts`

Coordinate event detection across all chunks:
```typescript
export interface EventProcessingOptions {
  maxConcurrency: number;
  batchSize: number;
  skipProcessed: boolean;
  llmProvider: 'openai' | 'anthropic';
}

export interface ProcessingProgress {
  novelId: string;
  totalChunks: number;
  processedChunks: number;
  eventsDetected: number;
  currentChunk?: number;
  status: 'starting' | 'processing' | 'completed' | 'failed';
  startedAt: Date;
  estimatedCompletion?: Date;
  errors: string[];
}

export class EventProcessingService {
  private eventDetector: EventDetector;
  private chunkRepository: NovelRepository;
  private progressTracker: Map<string, ProcessingProgress>;
  private eventQueue: PQueue;
  
  async processNovelEvents(
    novelId: string,
    options: EventProcessingOptions
  ): Promise<ProcessingProgress>;
  
  async getProcessingProgress(novelId: string): Promise<ProcessingProgress>;
  
  private async processChunkBatch(
    chunks: ITextChunk[],
    novelId: string,
    eventsReference: EventCSVRow[]
  ): Promise<DetectedEvent[]>;
  
  private async buildNovelContext(novelId: string): Promise<{
    title?: string;
    previousEvents: DetectedEvent[];
  }>;
  
  private updateProgress(
    novelId: string,
    update: Partial<ProcessingProgress>
  ): void;
  
  private emitProgressUpdate(novelId: string): void;
}
```

### 6. Rate Limiting and Retry Logic
**File**: `src/utils/llm-rate-limiter.ts`

Manage API rate limits and implement retry strategies:
```typescript
export class LLMRateLimiter {
  private limiter: Bottleneck;
  private tokenBucket: Map<string, number>;
  
  constructor(config: {
    maxConcurrent: number;
    minTime: number;
    maxRetries: number;
    retryDelay: number;
  });
  
  async execute<T>(
    provider: string,
    operation: () => Promise<T>,
    estimatedTokens: number
  ): Promise<T>;
  
  private async waitForTokens(provider: string, tokens: number): Promise<void>;
  private updateTokenUsage(provider: string, tokens: number): void;
}
```

## Database Integration

### Event Repository Extensions
**File**: `src/repositories/event-repository.ts`

Enhanced event repository for AI-detected events:
```typescript
export class EventRepository implements IEventRepository {
  async createDetectedEvent(
    event: DetectedEvent,
    context: AgentContext
  ): Promise<string>;
  
  async findEventsByChunk(chunkId: string): Promise<IEventNode[]>;
  
  async findSimilarEvents(
    eventName: string,
    textEvidence: string,
    threshold: number
  ): Promise<IEventNode[]>;
  
  async updateEventConfidence(eventId: string, confidence: number): Promise<void>;
  
  async getProcessingStats(novelId: string): Promise<{
    totalEvents: number;
    averageConfidence: number;
    chunksCovered: number;
    eventsPerChunk: number;
  }>;
}
```

### Agent Logging Repository
**File**: `src/repositories/agent-log-repository.ts`

Store all AI agent interactions:
```typescript
export class AgentLogRepository implements IAgentLogRepository {
  async log(entry: IAgentLog): Promise<void>;
  
  async getEventDetectionLogs(
    novelId: string,
    chunkId?: string
  ): Promise<IAgentLog[]>;
  
  async getAgentPerformanceMetrics(
    agentType: AgentType,
    timeRange: { start: Date; end: Date }
  ): Promise<{
    totalRequests: number;
    averageTokens: number;
    averageLatency: number;
    successRate: number;
  }>;
  
  async searchLogs(
    query: string,
    agentType?: AgentType
  ): Promise<IAgentLog[]>;
}
```

## API Endpoints

### Event Detection API
**File**: `src/routes/api/event-detection.ts`

Endpoints for managing event detection:
```typescript
// POST /api/v1/events/detect/:novelId
router.post('/detect/:novelId', async (req, res) => {
  const { novelId } = req.params;
  const options = req.body as EventProcessingOptions;
  
  const progress = await eventProcessingService.processNovelEvents(
    novelId,
    options
  );
  
  res.json({
    success: true,
    data: progress
  });
});

// GET /api/v1/events/progress/:novelId
router.get('/progress/:novelId', async (req, res) => {
  const progress = await eventProcessingService.getProcessingProgress(
    req.params.novelId
  );
  
  res.json({
    success: true,
    data: progress
  });
});

// GET /api/v1/events/novel/:novelId
router.get('/novel/:novelId', async (req, res) => {
  const events = await eventRepository.findByNovel(
    parseInt(req.params.novelId)
  );
  
  res.json({
    success: true,
    data: events
  });
});

// GET /api/v1/events/:eventId/logs
router.get('/:eventId/logs', async (req, res) => {
  const logs = await agentLogRepository.getEventDetectionLogs(
    req.params.eventId
  );
  
  res.json({
    success: true,
    data: logs
  });
});
```

## Real-time Communication

### WebSocket Events for Progress
**File**: `src/websocket/event-detection.ts`

Real-time progress updates:
```typescript
export class EventDetectionWebSocket {
  private io: Server;
  
  constructor(io: Server) {
    this.io = io;
  }
  
  emitProcessingUpdate(novelId: string, progress: ProcessingProgress): void {
    this.io.to(`novel:${novelId}`).emit('processing_update', {
      type: 'event_detection_progress',
      data: progress
    });
  }
  
  emitEventDetected(novelId: string, event: DetectedEvent): void {
    this.io.to(`novel:${novelId}`).emit('event_detected', {
      type: 'new_event',
      data: event
    });
  }
  
  emitAgentLog(novelId: string, log: IAgentLog): void {
    this.io.to(`novel:${novelId}`).emit('agent_log', {
      type: 'agent_interaction',
      data: log
    });
  }
}
```

## Configuration and Validation

### Event Detection Configuration
**File**: `src/config/event-detection.ts`

Configuration for event detection behavior:
```typescript
export const eventDetectionConfig = {
  llm: {
    defaultProvider: 'openai',
    models: {
      openai: 'gpt-4-turbo-preview',
      anthropic: 'claude-3-sonnet-20240229'
    },
    temperature: 0.1,
    maxTokens: 4000,
    timeout: 30000
  },
  processing: {
    maxConcurrency: 3,
    batchSize: 5,
    retryAttempts: 3,
    retryDelay: 1000,
    confidenceThreshold: 0.7
  },
  detection: {
    minEventLength: 10,
    maxEventLength: 500,
    contextWindow: 200,
    enableValidation: true
  }
};
```

### Zod Schemas for Validation
**File**: `src/schemas/event-detection.ts`

Type-safe validation schemas:
```typescript
export const DetectedEventSchema = z.object({
  eventName: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  csvRowId: z.string().optional(),
  textEvidence: z.string().min(10).max(500),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1).max(500),
  isNewEvent: z.boolean()
});

export const EventDetectionResponseSchema = z.array(DetectedEventSchema);

export const EventProcessingOptionsSchema = z.object({
  maxConcurrency: z.number().min(1).max(10).default(3),
  batchSize: z.number().min(1).max(20).default(5),
  skipProcessed: z.boolean().default(true),
  llmProvider: z.enum(['openai', 'anthropic']).default('openai')
});
```

## Testing

### Unit Tests
**File**: `src/tests/unit/event-detector.test.ts`

Test event detection logic:
```typescript
describe('EventDetector', () => {
  let detector: EventDetector;
  let mockLLMClient: jest.Mocked<ILLMProvider>;
  
  beforeEach(() => {
    mockLLMClient = createMockLLMClient();
    detector = new EventDetector(mockLLMClient, defaultConfig);
  });
  
  it('should detect events in text chunk', async () => {
    const mockChunk = createTestChunk('The hero defeated the dragon...');
    const mockEvents = [createTestEventReference('Dragon Battle')];
    
    mockLLMClient.generateStructuredOutput.mockResolvedValue([{
      eventName: 'Dragon Battle',
      description: 'Hero defeats the dragon',
      textEvidence: 'The hero defeated the dragon',
      confidence: 0.95,
      reasoning: 'Clear battle description',
      isNewEvent: false
    }]);
    
    const result = await detector.process({
      chunk: mockChunk,
      eventsReference: mockEvents,
      novelContext: { previousEvents: [] }
    }, createTestContext());
    
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].eventName).toBe('Dragon Battle');
  });
  
  it('should handle LLM errors gracefully', async () => {
    mockLLMClient.generateStructuredOutput.mockRejectedValue(
      new Error('API rate limit exceeded')
    );
    
    const result = await detector.process(
      createTestInput(),
      createTestContext()
    );
    
    expect(result.success).toBe(false);
    expect(result.errors).toContain('API rate limit exceeded');
  });
});
```

### Integration Tests
**File**: `src/tests/integration/event-detection-flow.test.ts`

Test complete event detection workflow:
```typescript
describe('Event Detection Integration', () => {
  it('should process complete novel for events', async () => {
    // Setup test novel and chunks
    const novel = await createTestNovel();
    const chunks = await createTestChunks(novel.id, 5);
    const eventsRef = await createTestEventsReference();
    
    // Process events
    const response = await request(app)
      .post(`/api/v1/events/detect/${novel.id}`)
      .send({
        maxConcurrency: 1,
        batchSize: 2,
        llmProvider: 'openai'
      })
      .expect(200);
    
    // Wait for processing to complete
    await waitForProcessingComplete(novel.id);
    
    // Verify events were detected
    const events = await eventRepository.findByNovel(novel.novelNumber);
    expect(events.length).toBeGreaterThan(0);
    
    // Verify agent logs were created
    const logs = await agentLogRepository.getEventDetectionLogs(novel.id);
    expect(logs.length).toBeGreaterThan(0);
  });
});
```

## Performance Monitoring

### Event Detection Metrics
**File**: `src/utils/event-detection-metrics.ts`

Track performance and quality metrics:
```typescript
export class EventDetectionMetrics {
  async recordDetection(
    novelId: string,
    chunkId: string,
    eventsFound: number,
    processingTime: number,
    tokensUsed: number
  ): Promise<void>;
  
  async getDetectionStats(
    novelId: string
  ): Promise<{
    totalEvents: number;
    averageEventsPerChunk: number;
    averageProcessingTime: number;
    totalTokensUsed: number;
    averageConfidence: number;
  }>;
  
  async getQualityMetrics(
    novelId: string
  ): Promise<{
    highConfidenceEvents: number;
    newEventsFound: number;
    csvMatchRate: number;
    duplicateRate: number;
  }>;
}
```

## Acceptance Criteria

### Functional Requirements
- ✅ Successfully detect major events from text chunks
- ✅ Match detected events to CSV reference when possible
- ✅ Store events with precise character position references
- ✅ Log all AI agent interactions for review
- ✅ Process multiple novels concurrently with rate limiting
- ✅ Provide real-time progress updates via WebSocket

### Quality Requirements
- ✅ Event detection accuracy ≥85% when compared to human baseline
- ✅ Confidence scores correlate with actual accuracy
- ✅ Text evidence extraction 99%+ position accuracy  
- ✅ No duplicate events within same chunk
- ✅ Handle API failures gracefully with retry logic

### Performance Requirements
- ✅ Process 2000-character chunks in under 10 seconds average
- ✅ Support 3+ concurrent LLM requests safely
- ✅ Memory usage under 1GB during processing
- ✅ 99.9% uptime for event detection service

## Deliverables

1. **AI Agent Framework**
   - Base agent class with common functionality
   - LLM provider abstraction layer
   - Rate limiting and retry mechanisms

2. **Event Detection Agent**
   - Event detection logic and prompts
   - Text evidence extraction with position tracking
   - Confidence scoring and validation

3. **Processing Orchestration**
   - Multi-chunk processing workflow
   - Progress tracking and reporting
   - Concurrent processing management

4. **API and WebSocket Integration**
   - Event detection endpoints
   - Real-time progress updates
   - Agent log access and search

This phase creates a robust AI-powered event detection system that forms the foundation for temporal analysis in subsequent phases.