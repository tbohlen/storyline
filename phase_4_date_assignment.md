# Phase 4: Date Assignment AI Agent

## Objective
Implement an AI agent that reads context around detected events to identify and extract absolute dates, temporal expressions, and date-related information, then updates event nodes in the graph database with temporal data.

## Technical Requirements

### Additional Dependencies
```json
{
  "dependencies": {
    "chrono-node": "^2.7.0",
    "date-fns": "^2.30.0",
    "natural": "^6.10.0",
    "compromise": "^14.10.0"
  }
}
```

## Core Components to Implement

### 1. Date Assignment Agent
**File**: `src/agents/date-assigner.ts`

Main date extraction and assignment logic:
```typescript
export interface DateAssignmentInput {
  event: IEventNode;
  contextWindow: {
    beforeText: string;
    afterText: string;
    fullChunkText: string;
  };
  novelMetadata: {
    estimatedTimeframe?: string;
    knownDates?: DateReference[];
    previousAssignments?: DateAssignment[];
  };
}

export interface DateAssignment {
  eventId: string;
  absoluteDate?: Date;
  dateExpression: string;
  dateConfidence: number;
  contextText: string;
  extractionMethod: 'explicit' | 'relative' | 'inferred' | 'none';
  reasoning: string;
  relativeToEventId?: string;
  ambiguityNotes?: string;
}

export interface DateReference {
  expression: string;
  parsedDate: Date;
  confidence: number;
  source: 'text' | 'metadata' | 'calculation';
}

export class DateAssigner extends BaseAgent {
  private dateParser: DateParser;
  private contextExtractor: ContextExtractor;
  private eventRepository: IEventRepository;
  
  async process(
    input: DateAssignmentInput,
    context: AgentContext
  ): Promise<AgentResult<DateAssignment>>;
  
  private buildDateExtractionPrompt(
    event: IEventNode,
    contextWindow: DateAssignmentInput['contextWindow'],
    novelMetadata: DateAssignmentInput['novelMetadata']
  ): string;
  
  private async extractDateFromContext(
    contextText: string,
    eventText: string
  ): Promise<{
    expressions: string[];
    candidates: DateReference[];
  }>;
  
  private async validateDateAssignment(
    assignment: DateAssignment,
    event: IEventNode
  ): Promise<{
    isValid: boolean;
    warnings: string[];
    confidence: number;
  }>;
  
  private async storeDateAssignment(
    assignment: DateAssignment,
    eventId: string
  ): Promise<void>;
}
```

### 2. Date Parser Service
**File**: `src/services/date-parser.ts`

Advanced date parsing with multiple strategies:
```typescript
export interface ParsedDate {
  date: Date;
  originalText: string;
  confidence: number;
  precision: 'year' | 'month' | 'day' | 'time';
  ambiguity: string[];
  method: 'chrono' | 'regex' | 'nlp' | 'relative';
}

export class DateParser {
  private chronoParser: any;
  private nlp: any;
  
  async parseDate(
    text: string,
    referenceDate?: Date
  ): Promise<ParsedDate[]>;
  
  private parseWithChrono(text: string, reference?: Date): ParsedDate[];
  private parseWithRegex(text: string): ParsedDate[];
  private parseWithNLP(text: string): ParsedDate[];
  private parseRelativeExpressions(text: string, reference?: Date): ParsedDate[];
  
  private identifyDatePatterns(text: string): {
    explicit: string[];      // "March 15, 1995"
    relative: string[];      // "three days later"
    seasonal: string[];      // "in the spring of"
    historical: string[];    // "during the war"
    vague: string[];        // "long ago", "recently"
  };
  
  private resolveDateAmbiguity(
    candidates: ParsedDate[],
    context: string
  ): ParsedDate;
  
  private validateDateRange(
    date: Date,
    allowedRange?: { start: Date; end: Date }
  ): boolean;
}
```

### 3. Context Extraction Service
**File**: `src/services/context-extractor.ts`

Extract relevant context around events for date analysis:
```typescript
export interface ContextWindow {
  beforeText: string;
  afterText: string;
  fullChunkText: string;
  characterStart: number;
  characterEnd: number;
  sentences: {
    before: string[];
    containing: string[];
    after: string[];
  };
}

export interface ContextExtractionOptions {
  windowSize: number;        // Characters before/after
  sentenceCount: number;     // Sentences before/after
  includeAdjacentChunks: boolean;
  filterRelevantSentences: boolean;
}

export class ContextExtractor {
  private chunkRepository: NovelRepository;
  
  async extractContext(
    event: IEventNode,
    options: ContextExtractionOptions
  ): Promise<ContextWindow>;
  
  private async getAdjacentChunks(
    chunkId: string,
    direction: 'before' | 'after' | 'both'
  ): Promise<ITextChunk[]>;
  
  private extractSentences(
    text: string,
    eventPosition: { start: number; end: number }
  ): {
    before: string[];
    containing: string[];
    after: string[];
  };
  
  private filterTemporallyRelevantSentences(
    sentences: string[]
  ): string[];
  
  private identifyTemporalMarkers(text: string): {
    timeWords: string[];
    dateExpressions: string[];
    sequenceMarkers: string[];
  };
}
```

### 4. Date Assignment Prompts
**File**: `src/agents/prompts/date-assignment.ts`

Specialized prompts for date extraction:
```typescript
export class DateAssignmentPrompts {
  static buildMainPrompt(
    event: IEventNode,
    contextWindow: ContextWindow,
    novelMetadata: DateAssignmentInput['novelMetadata']
  ): string {
    return `
You are an expert temporal analyst tasked with extracting and assigning dates to story events.

## Event to Analyze
Event: "${event.name}"
Description: "${event.description}"
Text Evidence: "${event.quotedText}"

## Context for Analysis
Text before event:
"""
${contextWindow.beforeText}
"""

Text containing event:
"""
${contextWindow.sentences.containing.join(' ')}
"""

Text after event:
"""
${contextWindow.afterText}
"""

## Novel Context
${novelMetadata.estimatedTimeframe ? `Time Period: ${novelMetadata.estimatedTimeframe}` : ''}
${novelMetadata.knownDates?.length ? `
Known Dates in Novel:
${novelMetadata.knownDates.map(d => `- ${d.expression}: ${d.parsedDate.toDateString()}`).join('\n')}
` : ''}

## Your Task
Analyze the context around this event and determine if there are any temporal markers that indicate when this event occurred. Look for:

1. **Explicit Dates**: Specific dates mentioned (e.g., "March 15, 1995", "Christmas Day")
2. **Relative Time**: References to other events (e.g., "three days after the wedding")
3. **Seasonal/Contextual**: Time indicators (e.g., "during the harsh winter", "in his youth")
4. **Sequential Markers**: Ordering words (e.g., "before", "after", "meanwhile", "then")

## Instructions
1. Scan the entire context for date-related information
2. Focus on text closest to the event for highest relevance
3. Consider both explicit dates and relative time expressions
4. Evaluate confidence based on clarity and specificity
5. Note any ambiguity or multiple possible interpretations

## Output Format
Respond with a JSON object:
{
  "absoluteDate": "YYYY-MM-DD" or null,
  "dateExpression": "exact text found that indicates timing",
  "dateConfidence": 0.85,
  "contextText": "surrounding text that provides the temporal clue",
  "extractionMethod": "explicit|relative|inferred|none",
  "reasoning": "explanation of why this date was chosen",
  "relativeToEventId": null,
  "ambiguityNotes": "any uncertainty or alternative interpretations"
}

## Important Guidelines
- Only assign dates you are confident about (>0.6 confidence)
- If multiple dates are mentioned, choose the one most directly related to the event
- For relative dates, note what they are relative to
- Mark confidence lower for ambiguous or unclear references
- Use null for absoluteDate if no clear date can be determined
- Be explicit about your reasoning process
`;
  }

  static buildValidationPrompt(
    assignment: DateAssignment,
    event: IEventNode,
    context: string
  ): string {
    return `
Validate this date assignment for accuracy and reasonableness:

Event: "${event.name}"
Assigned Date: ${assignment.absoluteDate?.toDateString() || 'None'}
Date Expression: "${assignment.dateExpression}"
Confidence: ${assignment.dateConfidence}
Method: ${assignment.extractionMethod}

Context: "${context}"

Questions to consider:
1. Is the date expression actually present in the context?
2. Does the assigned date logically correspond to the expression?
3. Is the confidence level appropriate for the clarity of evidence?
4. Are there any obvious errors or inconsistencies?

Respond with either:
- "VALID" if the assignment is correct
- "INVALID: [specific reason]" if there are problems
`;
  }

  static buildRelativeDateResolutionPrompt(
    assignment: DateAssignment,
    referenceEvents: IEventNode[],
    relationshipText: string
  ): string {
    return `
Resolve this relative date expression by finding the reference event:

Date Expression: "${assignment.dateExpression}"
Context: "${relationshipText}"

Possible Reference Events:
${referenceEvents.map(e => `
- ${e.name} (${e.absoluteDate?.toDateString() || 'No date'}): ${e.description}
`).join('')}

Determine:
1. Which event is being referenced
2. What time relationship is indicated (before/after/during)
3. How much time elapsed (if specified)

Respond with JSON:
{
  "referenceEventId": "uuid-of-reference-event",
  "timeRelation": "before|after|during",
  "timeGap": "duration if specified",
  "calculatedDate": "YYYY-MM-DD or null",
  "confidence": 0.8
}
`;
  }
}
```

### 5. Date Assignment Orchestrator
**File**: `src/services/date-assignment-service.ts`

Coordinate date assignment across all events:
```typescript
export interface DateAssignmentOptions {
  contextWindowSize: number;
  includeAdjacentChunks: boolean;
  processingOrder: 'chronological' | 'confidence' | 'detection_order';
  enableRelativeResolution: boolean;
  maxIterations: number;
}

export interface DateAssignmentProgress {
  novelId: string;
  totalEvents: number;
  processedEvents: number;
  datesAssigned: number;
  relativeDatesResolved: number;
  currentEvent?: string;
  status: 'starting' | 'processing' | 'resolving_relatives' | 'completed' | 'failed';
  startedAt: Date;
  estimatedCompletion?: Date;
  errors: string[];
  stats: {
    explicitDates: number;
    relativeDates: number;
    inferredDates: number;
    noDateFound: number;
    averageConfidence: number;
  };
}

export class DateAssignmentService {
  private dateAssigner: DateAssigner;
  private contextExtractor: ContextExtractor;
  private eventRepository: IEventRepository;
  private progressTracker: Map<string, DateAssignmentProgress>;
  
  async processNovelDates(
    novelId: string,
    options: DateAssignmentOptions
  ): Promise<DateAssignmentProgress>;
  
  async getDateAssignmentProgress(novelId: string): Promise<DateAssignmentProgress>;
  
  private async processEventBatch(
    events: IEventNode[],
    novelId: string,
    options: DateAssignmentOptions
  ): Promise<DateAssignment[]>;
  
  private async resolveRelativeDates(
    assignments: DateAssignment[],
    allEvents: IEventNode[]
  ): Promise<DateAssignment[]>;
  
  private async buildNovelTemporalContext(
    novelId: string
  ): Promise<{
    estimatedTimeframe?: string;
    knownDates: DateReference[];
    temporalAnchors: IEventNode[];
  }>;
  
  private calculateDateFromRelative(
    relativeAssignment: DateAssignment,
    referenceEvent: IEventNode
  ): Date | null;
  
  private updateProgress(
    novelId: string,
    update: Partial<DateAssignmentProgress>
  ): void;
}
```

### 6. Temporal Conflict Detector
**File**: `src/services/temporal-conflict-detector.ts`

Identify conflicts in assigned dates:
```typescript
export interface TemporalConflict {
  id: string;
  type: 'impossible_sequence' | 'date_mismatch' | 'relative_contradiction';
  severity: 'low' | 'medium' | 'high';
  description: string;
  involvedEvents: string[];
  conflictingDates: {
    eventId: string;
    assignedDate: Date;
    alternativeDate?: Date;
  }[];
  suggestedResolution?: string;
  confidence: number;
  detectedAt: Date;
}

export class TemporalConflictDetector {
  private eventRepository: IEventRepository;
  
  async detectConflicts(novelId: string): Promise<TemporalConflict[]>;
  
  private async findDateOrderConflicts(
    events: IEventNode[]
  ): Promise<TemporalConflict[]>;
  
  private async findRelativeDateConflicts(
    events: IEventNode[]
  ): Promise<TemporalConflict[]>;
  
  private async findImplausibleDates(
    events: IEventNode[],
    novelTimeframe?: { start: Date; end: Date }
  ): Promise<TemporalConflict[]>;
  
  private calculateConflictSeverity(
    conflict: Omit<TemporalConflict, 'severity'>
  ): 'low' | 'medium' | 'high';
  
  private generateResolutionSuggestions(
    conflict: TemporalConflict,
    events: IEventNode[]
  ): string[];
}
```

## Database Integration

### Enhanced Event Repository
**File**: `src/repositories/event-repository-enhanced.ts`

Extended repository for date operations:
```typescript
export class EnhancedEventRepository extends EventRepository {
  async updateEventDate(
    eventId: string,
    dateAssignment: DateAssignment
  ): Promise<void>;
  
  async findEventsWithDates(novelId: string): Promise<IEventNode[]>;
  
  async findEventsWithoutDates(novelId: string): Promise<IEventNode[]>;
  
  async findEventsByDateRange(
    startDate: Date,
    endDate: Date,
    novelId?: string
  ): Promise<IEventNode[]>;
  
  async getTemporalStatistics(
    novelId: string
  ): Promise<{
    totalEvents: number;
    eventsWithDates: number;
    explicitDates: number;
    relativeDates: number;
    averageConfidence: number;
    dateRange: { earliest: Date; latest: Date } | null;
  }>;
  
  async findRelatedEventsByDate(
    eventId: string,
    daysBefore: number,
    daysAfter: number
  ): Promise<IEventNode[]>;
}
```

### Temporal Conflicts Repository
**File**: `src/repositories/temporal-conflicts-repository.ts`

Store and manage temporal conflicts:
```typescript
export class TemporalConflictsRepository {
  async storeConflict(conflict: TemporalConflict): Promise<string>;
  
  async findConflictsByNovel(novelId: string): Promise<TemporalConflict[]>;
  
  async findConflictsByEvent(eventId: string): Promise<TemporalConflict[]>;
  
  async resolveConflict(
    conflictId: string,
    resolution: string,
    resolvedBy: string
  ): Promise<void>;
  
  async getConflictStatistics(
    novelId: string
  ): Promise<{
    totalConflicts: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
    resolvedCount: number;
  }>;
}
```

## API Endpoints

### Date Assignment API
**File**: `src/routes/api/date-assignment.ts`

Endpoints for date assignment operations:
```typescript
// POST /api/v1/dates/assign/:novelId
router.post('/assign/:novelId', async (req, res) => {
  const { novelId } = req.params;
  const options = req.body as DateAssignmentOptions;
  
  const progress = await dateAssignmentService.processNovelDates(
    novelId,
    options
  );
  
  res.json({
    success: true,
    data: progress
  });
});

// GET /api/v1/dates/progress/:novelId
router.get('/progress/:novelId', async (req, res) => {
  const progress = await dateAssignmentService.getDateAssignmentProgress(
    req.params.novelId
  );
  
  res.json({
    success: true,
    data: progress
  });
});

// GET /api/v1/dates/conflicts/:novelId
router.get('/conflicts/:novelId', async (req, res) => {
  const conflicts = await temporalConflictDetector.detectConflicts(
    req.params.novelId
  );
  
  res.json({
    success: true,
    data: conflicts
  });
});

// GET /api/v1/dates/timeline/:novelId
router.get('/timeline/:novelId', async (req, res) => {
  const events = await eventRepository.findEventsWithDates(req.params.novelId);
  const timeline = events
    .filter(e => e.absoluteDate)
    .sort((a, b) => a.absoluteDate!.getTime() - b.absoluteDate!.getTime());
  
  res.json({
    success: true,
    data: timeline
  });
});

// POST /api/v1/dates/resolve-conflict/:conflictId
router.post('/resolve-conflict/:conflictId', async (req, res) => {
  const { conflictId } = req.params;
  const { resolution, resolvedBy } = req.body;
  
  await temporalConflictsRepository.resolveConflict(
    conflictId,
    resolution,
    resolvedBy
  );
  
  res.json({
    success: true,
    message: 'Conflict resolution recorded'
  });
});
```

## Configuration and Validation

### Date Assignment Configuration
**File**: `src/config/date-assignment.ts`

Configuration for date assignment behavior:
```typescript
export const dateAssignmentConfig = {
  context: {
    windowSize: 400,           // Characters before/after event
    sentenceCount: 3,          // Sentences before/after
    includeAdjacentChunks: true,
    maxContextSize: 1000
  },
  parsing: {
    enableRelativeResolution: true,
    maxIterations: 3,
    confidenceThreshold: 0.6,
    allowedDateRange: {
      start: new Date('1000-01-01'),
      end: new Date('3000-12-31')
    }
  },
  validation: {
    enableConflictDetection: true,
    strictValidation: false,
    allowAmbiguousDates: true,
    maxDateDiscrepancy: 365     // Days
  }
};
```

### Zod Schemas
**File**: `src/schemas/date-assignment.ts`

Validation schemas for date assignment:
```typescript
export const DateAssignmentSchema = z.object({
  eventId: z.string().uuid(),
  absoluteDate: z.date().optional(),
  dateExpression: z.string().min(1).max(200),
  dateConfidence: z.number().min(0).max(1),
  contextText: z.string().min(1).max(500),
  extractionMethod: z.enum(['explicit', 'relative', 'inferred', 'none']),
  reasoning: z.string().min(1).max(500),
  relativeToEventId: z.string().uuid().optional(),
  ambiguityNotes: z.string().optional()
});

export const DateAssignmentOptionsSchema = z.object({
  contextWindowSize: z.number().min(100).max(2000).default(400),
  includeAdjacentChunks: z.boolean().default(true),
  processingOrder: z.enum(['chronological', 'confidence', 'detection_order']).default('confidence'),
  enableRelativeResolution: z.boolean().default(true),
  maxIterations: z.number().min(1).max(10).default(3)
});
```

## Testing

### Unit Tests
**File**: `src/tests/unit/date-assigner.test.ts`

Test date assignment logic:
```typescript
describe('DateAssigner', () => {
  let assigner: DateAssigner;
  let mockDateParser: jest.Mocked<DateParser>;
  
  beforeEach(() => {
    mockDateParser = createMockDateParser();
    assigner = new DateAssigner(mockLLMClient, defaultConfig);
  });
  
  it('should extract explicit dates from context', async () => {
    const event = createTestEvent();
    const context = createContextWindow(
      'It was March 15, 1995 when the hero',
      'defeated the dragon in epic battle',
      'The victory was celebrated for days'
    );
    
    mockLLMClient.generateStructuredOutput.mockResolvedValue({
      absoluteDate: new Date('1995-03-15'),
      dateExpression: 'March 15, 1995',
      dateConfidence: 0.95,
      contextText: 'It was March 15, 1995 when the hero defeated the dragon',
      extractionMethod: 'explicit',
      reasoning: 'Clear explicit date mentioned directly before event'
    });
    
    const result = await assigner.process({
      event,
      contextWindow: context,
      novelMetadata: {}
    }, createTestContext());
    
    expect(result.success).toBe(true);
    expect(result.data.absoluteDate).toEqual(new Date('1995-03-15'));
    expect(result.data.extractionMethod).toBe('explicit');
  });
  
  it('should handle relative date expressions', async () => {
    const event = createTestEvent();
    const context = createContextWindow(
      'Three days after the wedding ceremony',
      'the hero departed on his quest',
      'leaving behind his new bride'
    );
    
    mockLLMClient.generateStructuredOutput.mockResolvedValue({
      dateExpression: 'Three days after the wedding ceremony',
      dateConfidence: 0.8,
      contextText: 'Three days after the wedding ceremony the hero departed',
      extractionMethod: 'relative',
      reasoning: 'Relative to wedding event mentioned in previous chapter'
    });
    
    const result = await assigner.process({
      event,
      contextWindow: context,
      novelMetadata: {}
    }, createTestContext());
    
    expect(result.success).toBe(true);
    expect(result.data.extractionMethod).toBe('relative');
    expect(result.data.dateExpression).toContain('Three days after');
  });
});
```

### Integration Tests
**File**: `src/tests/integration/date-assignment-flow.test.ts`

Test complete date assignment workflow:
```typescript
describe('Date Assignment Integration', () => {
  it('should assign dates to all events in novel', async () => {
    // Setup test novel with events
    const novel = await createTestNovel();
    const events = await createTestEvents(novel.id, 10);
    
    // Process date assignments
    const response = await request(app)
      .post(`/api/v1/dates/assign/${novel.id}`)
      .send({
        contextWindowSize: 300,
        includeAdjacentChunks: true,
        enableRelativeResolution: true
      })
      .expect(200);
    
    // Wait for processing to complete
    await waitForDateAssignmentComplete(novel.id);
    
    // Verify dates were assigned
    const eventsWithDates = await eventRepository.findEventsWithDates(novel.id);
    expect(eventsWithDates.length).toBeGreaterThan(0);
    
    // Verify temporal conflicts were detected if any
    const conflicts = await temporalConflictDetector.detectConflicts(novel.id);
    expect(Array.isArray(conflicts)).toBe(true);
  });
});
```

## Performance Considerations

### Date Parsing Optimization
- Cache parsed date expressions to avoid recomputation
- Use efficient text processing for large context windows
- Parallel processing where safe for date parsing

### Memory Management
- Process events in batches to control memory usage
- Clean up temporary context data promptly
- Stream large text content when possible

## Acceptance Criteria

### Functional Requirements
- ✅ Extract explicit dates with 95%+ accuracy
- ✅ Identify relative date expressions with 85%+ accuracy
- ✅ Detect temporal conflicts and inconsistencies
- ✅ Update event nodes with temporal information
- ✅ Handle ambiguous date expressions gracefully
- ✅ Provide confidence scores for all assignments

### Quality Requirements
- ✅ Date parsing accuracy ≥90% on test dataset
- ✅ Context extraction includes relevant temporal clues
- ✅ Conflict detection identifies major inconsistencies
- ✅ Relative date resolution with iterative improvement
- ✅ Temporal consistency validation across novel

### Performance Requirements
- ✅ Process events for date assignment in under 5 seconds each
- ✅ Context extraction under 1 second per event
- ✅ Support processing 100+ events concurrently
- ✅ Memory usage under 2GB during processing

## Deliverables

1. **Date Assignment Agent**
   - Date extraction and parsing logic
   - Context analysis and temporal marker identification
   - Confidence scoring and validation

2. **Temporal Analysis Services**
   - Advanced date parsing with multiple strategies
   - Context extraction with intelligent windowing
   - Conflict detection and reporting

3. **Database Integration**
   - Event repository extensions for temporal data
   - Conflict storage and management
   - Temporal query capabilities

4. **API and Monitoring**
   - Date assignment endpoints
   - Progress tracking and statistics
   - Conflict resolution workflow

This phase creates sophisticated temporal analysis capabilities that enable precise timeline construction and conflict detection across the novel series.