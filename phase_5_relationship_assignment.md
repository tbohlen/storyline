# Phase 5: Relationship Assignment AI Agent

## Objective
Implement an AI agent that analyzes text around events to identify temporal relationships (before, after, simultaneous, etc.) and creates graph edges between event nodes, including dynamic creation of new event nodes when referenced events are discovered.

## Technical Requirements

### Additional Dependencies
```json
{
  "dependencies": {
    "fuse.js": "^7.0.0",
    "string-similarity": "^4.0.4",
    "compromise": "^14.10.0",
    "compromise-dates": "^0.1.0"
  }
}
```

## Core Components to Implement

### 1. Relationship Assignment Agent
**File**: `src/agents/relationship-assigner.ts`

Main relationship detection and assignment logic:
```typescript
export interface RelationshipAssignmentInput {
  event: IEventNode;
  contextWindow: {
    beforeText: string;
    afterText: string;
    fullChunkText: string;
    adjacentChunks?: ITextChunk[];
  };
  allKnownEvents: IEventNode[];
  existingRelationships: ITemporalRelationship[];
}

export interface DetectedRelationship {
  sourceEventId: string;
  targetEventId?: string;
  targetEventDescription?: string;
  relationshipType: RelationshipType;
  confidence: number;
  textEvidence: string;
  contextBefore: string;
  contextAfter: string;
  extractionMethod: 'explicit' | 'implicit' | 'inferred';
  reasoning: string;
  temporalMarkers: string[];
  isNewTargetEvent: boolean;
  ambiguityNotes?: string;
}

export interface NewEventFromRelationship {
  name: string;
  description: string;
  textEvidence: string;
  confidence: number;
  relationshipToSource: RelationshipType;
  inferredFromEventId: string;
}

export class RelationshipAssigner extends BaseAgent {
  private eventRepository: IEventRepository;
  private relationshipRepository: IRelationshipRepository;
  private eventMatcher: EventMatcher;
  private temporalParser: TemporalRelationshipParser;
  
  async process(
    input: RelationshipAssignmentInput,
    context: AgentContext
  ): Promise<AgentResult<{
    relationships: DetectedRelationship[];
    newEvents: NewEventFromRelationship[];
  }>>;
  
  private buildRelationshipPrompt(
    event: IEventNode,
    contextWindow: RelationshipAssignmentInput['contextWindow'],
    knownEvents: IEventNode[]
  ): string;
  
  private async extractRelationshipsFromResponse(
    response: string,
    sourceEvent: IEventNode,
    knownEvents: IEventNode[]
  ): Promise<{
    relationships: DetectedRelationship[];
    newEvents: NewEventFromRelationship[];
  }>;
  
  private async createNewEventFromReference(
    eventRef: NewEventFromRelationship,
    context: AgentContext
  ): Promise<string>;
  
  private async storeRelationship(
    relationship: DetectedRelationship,
    context: AgentContext
  ): Promise<string>;
}
```

### 2. Temporal Relationship Parser
**File**: `src/services/temporal-relationship-parser.ts`

Parse and understand temporal language:
```typescript
export interface TemporalExpression {
  text: string;
  type: 'sequence' | 'duration' | 'frequency' | 'simultaneity';
  direction: 'before' | 'after' | 'during' | 'simultaneous';
  intensity: 'immediate' | 'short' | 'long' | 'indefinite';
  confidence: number;
  normalizedForm: string;
}

export interface RelationshipPattern {
  pattern: RegExp;
  type: RelationshipType;
  confidence: number;
  contextRequired: boolean;
}

export class TemporalRelationshipParser {
  private patterns: RelationshipPattern[];
  private temporalMarkers: Map<string, TemporalExpression>;
  
  constructor() {
    this.initializePatterns();
    this.initializeTemporalMarkers();
  }
  
  parseTemporalExpressions(text: string): TemporalExpression[];
  
  identifyRelationshipPatterns(
    text: string,
    sourceEvent: string,
    targetEvents: string[]
  ): {
    pattern: RelationshipPattern;
    sourcePos: number;
    targetPos: number;
    evidence: string;
  }[];
  
  private initializePatterns(): void;
  private initializeTemporalMarkers(): void;
  
  private extractSequenceMarkers(text: string): {
    marker: string;
    position: number;
    type: RelationshipType;
    confidence: number;
  }[];
  
  private analyzeSentenceStructure(
    sentence: string,
    eventNames: string[]
  ): {
    subjectEvent?: string;
    temporalMarker?: string;
    objectEvent?: string;
    relationshipType?: RelationshipType;
  };
  
  normalizeTemporalExpression(expression: string): string;
}
```

### 3. Event Matcher Service
**File**: `src/services/event-matcher.ts`

Match textual event references to known events:
```typescript
export interface EventMatch {
  eventId: string;
  matchedText: string;
  confidence: number;
  matchType: 'exact' | 'fuzzy' | 'semantic' | 'contextual';
  evidence: string[];
}

export interface EventReference {
  text: string;
  position: { start: number; end: number };
  context: string;
  possibleMatches: EventMatch[];
}

export class EventMatcher {
  private fuzzySearcher: Fuse<IEventNode>;
  private semanticMatcher: SemanticMatcher;
  
  constructor(events: IEventNode[]) {
    this.initializeFuzzySearch(events);
    this.semanticMatcher = new SemanticMatcher();
  }
  
  findEventReferences(
    text: string,
    knownEvents: IEventNode[]
  ): EventReference[];
  
  matchEventByName(
    eventName: string,
    knownEvents: IEventNode[],
    threshold: number = 0.7
  ): EventMatch[];
  
  matchEventByDescription(
    description: string,
    knownEvents: IEventNode[],
    threshold: number = 0.6
  ): EventMatch[];
  
  private initializeFuzzySearch(events: IEventNode[]): void;
  
  private findExactMatches(
    text: string,
    events: IEventNode[]
  ): EventReference[];
  
  private findFuzzyMatches(
    text: string,
    events: IEventNode[]
  ): EventReference[];
  
  private findContextualMatches(
    text: string,
    events: IEventNode[],
    context: string
  ): EventReference[];
  
  private calculateMatchConfidence(
    reference: string,
    event: IEventNode,
    context: string
  ): number;
}
```

### 4. Relationship Assignment Prompts
**File**: `src/agents/prompts/relationship-assignment.ts`

Specialized prompts for relationship detection:
```typescript
export class RelationshipAssignmentPrompts {
  static buildMainPrompt(
    event: IEventNode,
    contextWindow: RelationshipAssignmentInput['contextWindow'],
    knownEvents: IEventNode[]
  ): string {
    return `
You are an expert narrative analyst tasked with identifying temporal relationships between story events.

## Primary Event
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
${contextWindow.fullChunkText}
"""

Text after event:
"""
${contextWindow.afterText}
"""

## Known Events in Novel
${knownEvents.map(e => `
- "${e.name}": ${e.description}
  ${e.absoluteDate ? `(Date: ${e.absoluteDate.toDateString()})` : '(No date assigned)'}
`).join('')}

## Your Task
Analyze the context around the primary event and identify any temporal relationships with other events. Look for:

1. **Explicit Temporal Markers**: Words like "before", "after", "during", "while", "then", "next", "previously"
2. **Sequential Indicators**: "first", "second", "finally", "meanwhile", "simultaneously"
3. **Causal Relationships**: "because of", "as a result", "following", "due to"
4. **Event References**: Mentions of other significant events, even if not in the known events list

## Relationship Types to Identify
- BEFORE: This event happened before another event
- AFTER: This event happened after another event  
- SIMULTANEOUS: This event happened at the same time as another
- LONG_BEFORE: This event happened significantly before another
- SHORTLY_AFTER: This event happened soon after another
- DURING: This event happened during another event
- OVERLAPS: This event partially overlapped with another

## Instructions
1. Scan the entire context for references to other events
2. Identify temporal relationship indicators
3. Match event references to known events when possible
4. Note new events that are referenced but not in the known list
5. Extract exact text evidence for each relationship
6. Assess confidence based on clarity of temporal indicators

## Output Format
Respond with a JSON object:
{
  "relationships": [
    {
      "targetEventName": "Name of the related event",
      "targetEventId": "uuid-if-matches-known-event or null",
      "relationshipType": "BEFORE|AFTER|SIMULTANEOUS|etc",
      "confidence": 0.85,
      "textEvidence": "exact quote showing the relationship",
      "contextBefore": "text before the evidence",
      "contextAfter": "text after the evidence",
      "extractionMethod": "explicit|implicit|inferred",
      "reasoning": "why you identified this relationship",
      "temporalMarkers": ["before", "when", "after"],
      "isNewTargetEvent": false
    }
  ],
  "newEvents": [
    {
      "name": "Name of newly discovered event",
      "description": "What this event involves",
      "textEvidence": "text that describes this event",
      "confidence": 0.8,
      "relationshipToSource": "BEFORE|AFTER|etc",
      "reasoning": "why this appears to be a significant event"
    }
  ]
}

## Important Guidelines
- Only identify relationships with clear temporal indicators (>0.6 confidence)
- Match to known events when text clearly refers to them
- Create new events only for significant occurrences mentioned in context
- Be precise with text evidence - extract exact quotes
- Consider both direct and implied temporal relationships
- Note ambiguous cases in reasoning
`;
  }

  static buildValidationPrompt(
    relationships: DetectedRelationship[],
    newEvents: NewEventFromRelationship[],
    sourceEvent: IEventNode,
    context: string
  ): string {
    return `
Validate these detected temporal relationships for accuracy:

Source Event: "${sourceEvent.name}"

Detected Relationships:
${relationships.map((rel, i) => `
${i + 1}. ${sourceEvent.name} ${rel.relationshipType} ${rel.targetEventId ? 'Known Event' : rel.targetEventDescription}
   Evidence: "${rel.textEvidence}"
   Confidence: ${rel.confidence}
   Markers: [${rel.temporalMarkers.join(', ')}]
`).join('')}

New Events Discovered:
${newEvents.map((event, i) => `
${i + 1}. "${event.name}": ${event.description}
   Relationship: ${sourceEvent.name} ${event.relationshipToSource} ${event.name}
   Evidence: "${event.textEvidence}"
`).join('')}

Context: "${context}"

Verification Questions:
1. Are the temporal markers actually present in the evidence text?
2. Do the relationship types match the temporal indicators?
3. Are the confidence levels appropriate?
4. Are new events truly significant story events?
5. Is the evidence text accurately extracted?

Respond with:
- "VALID" if all relationships are correctly identified
- "ISSUES: [specific problems]" if there are errors
`;
  }

  static buildDisambiguationPrompt(
    ambiguousReference: string,
    possibleMatches: EventMatch[],
    context: string
  ): string {
    return `
Disambiguate this event reference using context:

Reference Text: "${ambiguousReference}"
Context: "${context}"

Possible Matches:
${possibleMatches.map((match, i) => `
${i + 1}. "${match.eventId}": ${match.matchedText}
   Confidence: ${match.confidence}
   Type: ${match.matchType}
`).join('')}

Which event is most likely being referenced? Consider:
1. Contextual clues in the surrounding text
2. Temporal logic (what makes sense chronologically)
3. Narrative consistency
4. Specific details that match event descriptions

Respond with JSON:
{
  "selectedEventId": "uuid-of-best-match or null",
  "confidence": 0.8,
  "reasoning": "explanation of choice",
  "alternativeInterpretation": "if none match perfectly"
}
`;
  }
}
```

### 5. Relationship Processing Orchestrator
**File**: `src/services/relationship-processing-service.ts`

Coordinate relationship assignment across all events:
```typescript
export interface RelationshipProcessingOptions {
  maxConcurrency: number;
  contextWindowSize: number;
  includeAdjacentChunks: boolean;
  enableNewEventCreation: boolean;
  relationshipConfidenceThreshold: number;
  maxIterations: number;
}

export interface RelationshipProcessingProgress {
  novelId: string;
  totalEvents: number;
  processedEvents: number;
  relationshipsCreated: number;
  newEventsCreated: number;
  currentEvent?: string;
  status: 'starting' | 'processing' | 'validating' | 'completed' | 'failed';
  startedAt: Date;
  estimatedCompletion?: Date;
  errors: string[];
  stats: {
    explicitRelationships: number;
    implicitRelationships: number;
    inferredRelationships: number;
    averageConfidence: number;
    relationshipTypes: Record<RelationshipType, number>;
  };
}

export class RelationshipProcessingService {
  private relationshipAssigner: RelationshipAssigner;
  private eventMatcher: EventMatcher;
  private eventRepository: IEventRepository;
  private relationshipRepository: IRelationshipRepository;
  private progressTracker: Map<string, RelationshipProcessingProgress>;
  
  async processNovelRelationships(
    novelId: string,
    options: RelationshipProcessingOptions
  ): Promise<RelationshipProcessingProgress>;
  
  async getRelationshipProcessingProgress(novelId: string): Promise<RelationshipProcessingProgress>;
  
  private async processEventBatch(
    events: IEventNode[],
    allEvents: IEventNode[],
    novelId: string,
    options: RelationshipProcessingOptions
  ): Promise<{
    relationships: DetectedRelationship[];
    newEvents: NewEventFromRelationship[];
  }>;
  
  private async validateRelationships(
    relationships: DetectedRelationship[],
    sourceEvent: IEventNode
  ): Promise<DetectedRelationship[]>;
  
  private async createDiscoveredEvents(
    newEvents: NewEventFromRelationship[],
    novelId: string
  ): Promise<IEventNode[]>;
  
  private async detectCircularDependencies(
    relationships: ITemporalRelationship[]
  ): Promise<ITemporalRelationship[]>;
  
  private updateProgress(
    novelId: string,
    update: Partial<RelationshipProcessingProgress>
  ): void;
}
```

### 6. Relationship Repository
**File**: `src/repositories/relationship-repository.ts`

Database operations for temporal relationships:
```typescript
export interface IRelationshipRepository {
  createRelationship(relationship: ITemporalRelationship): Promise<string>;
  findRelationshipsByEvent(eventId: string): Promise<ITemporalRelationship[]>;
  findRelationshipsByType(type: RelationshipType, novelId?: string): Promise<ITemporalRelationship[]>;
  updateRelationshipConfidence(relationshipId: string, confidence: number): Promise<void>;
  deleteRelationship(relationshipId: string): Promise<void>;
  findCircularDependencies(novelId: string): Promise<ITemporalRelationship[][]>;
  getRelationshipStatistics(novelId: string): Promise<RelationshipStatistics>;
}

export interface RelationshipStatistics {
  totalRelationships: number;
  byType: Record<RelationshipType, number>;
  averageConfidence: number;
  eventsWithRelationships: number;
  orphanedEvents: number;
  circularDependencies: number;
}

export class RelationshipRepository implements IRelationshipRepository {
  private db: GraphDatabase;
  
  async createRelationship(relationship: ITemporalRelationship): Promise<string> {
    const query = `
      MATCH (source:Event {id: $sourceId}), (target:Event {id: $targetId})
      CREATE (source)-[r:${relationship.type} {
        id: $id,
        confidence: $confidence,
        textEvidence: $textEvidence,
        contextBefore: $contextBefore,
        contextAfter: $contextAfter,
        createdAt: datetime()
      }]->(target)
      RETURN r.id as id
    `;
    
    const result = await this.db.runQuery<{ id: string }>(
      query,
      {
        sourceId: relationship.sourceEventId,
        targetId: relationship.targetEventId,
        id: relationship.id,
        confidence: relationship.confidence,
        textEvidence: relationship.textEvidence,
        contextBefore: relationship.contextBefore,
        contextAfter: relationship.contextAfter
      }
    );
    
    return result[0].id;
  }
  
  async findCircularDependencies(novelId: string): Promise<ITemporalRelationship[][]> {
    const query = `
      MATCH (novel:Novel {id: $novelId})<-[:OCCURS_IN]-(e:Event)
      MATCH path = (e)-[:BEFORE*2..10]->(e)
      RETURN path
    `;
    
    const result = await this.db.runQuery(query, { novelId });
    return this.parseCyclePaths(result);
  }
  
  private parseCyclePaths(result: any[]): ITemporalRelationship[][] {
    // Implementation to parse Neo4j path results into relationship chains
    return [];
  }
}
```

## Database Schema Extensions

### Enhanced Relationship Types
```cypher
// Temporal relationship with evidence
CREATE (source:Event)-[r:BEFORE {
  id: string,
  confidence: float,
  textEvidence: string,
  contextBefore: string,
  contextAfter: string,
  temporalMarkers: [string],
  extractionMethod: string,
  reasoning: string,
  createdAt: datetime,
  validatedAt: datetime,
  validatedBy: string
}]->(target:Event)

// Similar patterns for AFTER, SIMULTANEOUS, etc.

// Relationship validation status
CREATE (r:Relationship)-[:VALIDATED_BY]->(validator:Agent)
CREATE (r:Relationship)-[:CONFLICTS_WITH]->(other:Relationship)
```

### Relationship Query Patterns
```cypher
// Find event timeline
MATCH (e:Event {novelNumber: $novelNumber})
WHERE e.absoluteDate IS NOT NULL
OPTIONAL MATCH (e)-[r:BEFORE|AFTER]->(related:Event)
RETURN e, collect(r) as relationships, collect(related) as relatedEvents
ORDER BY e.absoluteDate;

// Detect relationship conflicts
MATCH (a:Event)-[r1:BEFORE]->(b:Event)
MATCH (b:Event)-[r2:BEFORE]->(c:Event)  
MATCH (c:Event)-[r3:BEFORE]->(a:Event)
RETURN a, b, c, r1, r2, r3;

// Find most connected events
MATCH (e:Event)-[r]-(other:Event)
WHERE e.novelNumber = $novelNumber
RETURN e.name, count(r) as connectionCount
ORDER BY connectionCount DESC;
```

## API Endpoints

### Relationship Assignment API
**File**: `src/routes/api/relationship-assignment.ts`

```typescript
// POST /api/v1/relationships/assign/:novelId
router.post('/assign/:novelId', async (req, res) => {
  const { novelId } = req.params;
  const options = req.body as RelationshipProcessingOptions;
  
  const progress = await relationshipProcessingService.processNovelRelationships(
    novelId,
    options
  );
  
  res.json({
    success: true,
    data: progress
  });
});

// GET /api/v1/relationships/novel/:novelId
router.get('/novel/:novelId', async (req, res) => {
  const relationships = await relationshipRepository.findRelationshipsByType(
    undefined,
    req.params.novelId
  );
  
  res.json({
    success: true,
    data: relationships
  });
});

// GET /api/v1/relationships/event/:eventId
router.get('/event/:eventId', async (req, res) => {
  const relationships = await relationshipRepository.findRelationshipsByEvent(
    req.params.eventId
  );
  
  res.json({
    success: true,
    data: relationships
  });
});

// GET /api/v1/relationships/timeline/:novelId
router.get('/timeline/:novelId', async (req, res) => {
  const timeline = await buildEventTimeline(req.params.novelId);
  
  res.json({
    success: true,
    data: timeline
  });
});

// GET /api/v1/relationships/conflicts/:novelId
router.get('/conflicts/:novelId', async (req, res) => {
  const conflicts = await relationshipRepository.findCircularDependencies(
    req.params.novelId
  );
  
  res.json({
    success: true,
    data: conflicts
  });
});
```

## Testing

### Unit Tests
**File**: `src/tests/unit/relationship-assigner.test.ts`

```typescript
describe('RelationshipAssigner', () => {
  let assigner: RelationshipAssigner;
  let mockEventMatcher: jest.Mocked<EventMatcher>;
  
  beforeEach(() => {
    mockEventMatcher = createMockEventMatcher();
    assigner = new RelationshipAssigner(mockLLMClient, defaultConfig);
  });
  
  it('should detect BEFORE relationships', async () => {
    const sourceEvent = createTestEvent('Battle of Dragons');
    const targetEvent = createTestEvent('Hero Training');
    const context = createContextWindow(
      'Before the epic Battle of Dragons',
      'the hero had completed his training',
      'which prepared him for the challenge'
    );
    
    mockLLMClient.generateStructuredOutput.mockResolvedValue({
      relationships: [{
        targetEventName: 'Hero Training',
        targetEventId: targetEvent.id,
        relationshipType: 'BEFORE',
        confidence: 0.9,
        textEvidence: 'Before the epic Battle of Dragons the hero had completed his training',
        temporalMarkers: ['Before'],
        extractionMethod: 'explicit',
        reasoning: 'Clear temporal marker "Before" indicates training happened first'
      }],
      newEvents: []
    });
    
    const result = await assigner.process({
      event: sourceEvent,
      contextWindow: context,
      allKnownEvents: [targetEvent],
      existingRelationships: []
    }, createTestContext());
    
    expect(result.success).toBe(true);
    expect(result.data.relationships).toHaveLength(1);
    expect(result.data.relationships[0].relationshipType).toBe('BEFORE');
  });
  
  it('should create new events from references', async () => {
    const sourceEvent = createTestEvent('Final Battle');
    const context = createContextWindow(
      'After the mysterious prophecy was revealed',
      'the final battle commenced with great fury',
      'determining the fate of the kingdom'
    );
    
    mockLLMClient.generateStructuredOutput.mockResolvedValue({
      relationships: [],
      newEvents: [{
        name: 'Prophecy Revelation',
        description: 'The mysterious prophecy was revealed',
        textEvidence: 'the mysterious prophecy was revealed',
        confidence: 0.8,
        relationshipToSource: 'BEFORE',
        reasoning: 'Referenced as happening before the final battle'
      }]
    });
    
    const result = await assigner.process({
      event: sourceEvent,
      contextWindow: context,
      allKnownEvents: [],
      existingRelationships: []
    }, createTestContext());
    
    expect(result.success).toBe(true);
    expect(result.data.newEvents).toHaveLength(1);
    expect(result.data.newEvents[0].name).toBe('Prophecy Revelation');
  });
});
```

## Performance Considerations

### Relationship Processing Optimization
- Process events in dependency order to minimize iterations
- Cache event matching results to avoid recomputation  
- Use parallel processing for independent relationship detection
- Implement early termination for low-confidence relationships

### Memory and Storage
- Stream large context windows to manage memory
- Index relationships for fast traversal queries
- Compress textual evidence for storage efficiency
- Clean up temporary processing data

## Acceptance Criteria

### Functional Requirements
- ✅ Detect temporal relationships with 80%+ accuracy
- ✅ Create new event nodes from textual references  
- ✅ Match event references to existing events correctly
- ✅ Store relationships with supporting evidence
- ✅ Identify circular dependencies and conflicts
- ✅ Process entire novel series consistently

### Quality Requirements
- ✅ Relationship confidence scores correlate with accuracy
- ✅ Text evidence extraction with precise quotes
- ✅ Handle ambiguous temporal expressions gracefully
- ✅ Maintain referential integrity in graph database
- ✅ Validate relationship consistency across events

### Performance Requirements
- ✅ Process relationships for 100 events in under 5 minutes
- ✅ Support concurrent relationship detection
- ✅ Memory usage under 3GB during processing
- ✅ Graph queries respond in under 2 seconds

## Deliverables

1. **Relationship Assignment Agent**
   - Temporal relationship detection and classification
   - Event reference matching and disambiguation
   - New event creation from textual references

2. **Temporal Analysis Services**
   - Advanced temporal language parsing
   - Event matching with fuzzy and semantic search
   - Relationship validation and conflict detection

3. **Graph Database Integration**
   - Relationship repository with complex queries
   - Circular dependency detection
   - Timeline construction and validation

4. **API and Visualization Support**
   - Relationship management endpoints
   - Timeline and network query capabilities
   - Conflict reporting and resolution

This phase completes the core AI analysis pipeline by creating a rich network of temporal relationships that enables sophisticated timeline analysis and conflict detection across the novel series.