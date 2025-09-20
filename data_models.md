# Data Models and Schemas

## Core Domain Models

### Event Model
```typescript
export interface IEvent {
  id: string;                    // UUID for the event
  name: string;                  // Event name from CSV
  description: string;           // Event description from CSV  
  novelNumber: number;           // Which novel (1-5)
  chunkNumber: number;           // Which chunk in the novel
  characterStart: number;        // Start position in original text
  characterEnd: number;          // End position in original text
  quotedText: string;           // Actual text excerpt
  csvRowId?: string;            // Reference to CSV row if matched
  confidence: number;            // AI confidence score (0-1)
  createdAt: Date;
  updatedAt: Date;
}

export interface IEventWithDates extends IEvent {
  absoluteDate?: Date;           // Extracted absolute date
  dateExpression?: string;       // Original date text found
  dateConfidence?: number;       // Confidence in date extraction
  dateContext: string;          // Surrounding text for date
}

export interface IEventNode extends IEventWithDates {
  relationships: ITemporalRelationship[];
}
```

### Temporal Relationship Model
```typescript
export enum RelationshipType {
  BEFORE = 'BEFORE',
  AFTER = 'AFTER', 
  SIMULTANEOUS = 'SIMULTANEOUS',
  LONG_BEFORE = 'LONG_BEFORE',
  SHORTLY_AFTER = 'SHORTLY_AFTER',
  DURING = 'DURING',
  OVERLAPS = 'OVERLAPS'
}

export interface ITemporalRelationship {
  id: string;
  sourceEventId: string;
  targetEventId: string;
  type: RelationshipType;
  confidence: number;            // AI confidence in relationship
  textEvidence: string;          // Text that indicates relationship
  contextBefore: string;         // Text before the evidence
  contextAfter: string;          // Text after the evidence
  createdAt: Date;
}
```

### Document Processing Models
```typescript
export interface INovel {
  id: string;
  filename: string;
  originalPath: string;
  novelNumber: number;
  title?: string;
  author?: string;
  wordCount: number;
  chunkCount: number;
  processedAt?: Date;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

export interface ITextChunk {
  id: string;
  novelId: string;
  chunkNumber: number;
  content: string;
  characterStart: number;
  characterEnd: number;
  wordCount: number;
  overlap: {
    previousChunk?: string;      // Overlapping text with previous
    nextChunk?: string;          // Overlapping text with next
  };
}

export interface IEventsCSV {
  id: string;
  filename: string;
  rows: IEventCSVRow[];
  uploadedAt: Date;
}

export interface IEventCSVRow {
  rowNumber: number;
  eventId: string;
  eventName: string;
  description: string;
  novelNumber?: number;
  category?: string;
  notes?: string;
}
```

### AI Agent Models
```typescript
export enum AgentType {
  EVENT_DETECTOR = 'event_detector',
  DATE_ASSIGNER = 'date_assigner', 
  RELATIONSHIP_ASSIGNER = 'relationship_assigner'
}

export interface IAgentLog {
  id: string;
  agentType: AgentType;
  direction: 'prompt' | 'response';
  content: string;
  timestamp: Date;
  context: {
    novelId?: string;
    chunkId?: string;
    eventId?: string;
    processingStep?: string;
  };
  metadata: {
    model?: string;
    tokenCount?: number;
    processingTime?: number;
    temperature?: number;
  };
}

export interface IAgentResult<T> {
  success: boolean;
  data?: T;
  confidence: number;
  reasoning?: string;
  errors?: string[];
  warnings?: string[];
}
```

## Neo4j Graph Schema

### Node Types
```cypher
// Event Node
CREATE CONSTRAINT event_id IF NOT EXISTS FOR (e:Event) REQUIRE e.id IS UNIQUE;

(:Event {
  id: string,                    // Primary identifier
  name: string,                  // Event name
  description: string,           // Event description
  novelNumber: integer,          // Novel reference (1-5)
  chunkNumber: integer,          // Chunk reference
  characterStart: integer,       // Text position start
  characterEnd: integer,         // Text position end
  quotedText: string,           // Actual text excerpt
  csvRowId: string,             // CSV reference
  confidence: float,            // Detection confidence
  absoluteDate: date,           // Extracted date (optional)
  dateExpression: string,       // Original date text
  dateConfidence: float,        // Date extraction confidence
  createdAt: datetime,
  updatedAt: datetime
})

// Novel Node  
CREATE CONSTRAINT novel_id IF NOT EXISTS FOR (n:Novel) REQUIRE n.id IS UNIQUE;

(:Novel {
  id: string,
  filename: string,
  novelNumber: integer,
  title: string,
  wordCount: integer,
  chunkCount: integer,
  status: string,
  processedAt: datetime
})

// Chunk Node
CREATE CONSTRAINT chunk_id IF NOT EXISTS FOR (c:Chunk) REQUIRE c.id IS UNIQUE;

(:Chunk {
  id: string,
  chunkNumber: integer,
  wordCount: integer,
  characterStart: integer,
  characterEnd: integer
})
```

### Relationship Types
```cypher
// Temporal Relationships
(:Event)-[:BEFORE {
  confidence: float,
  textEvidence: string,
  contextBefore: string,
  contextAfter: string,
  createdAt: datetime
}]->(:Event)

(:Event)-[:AFTER {
  confidence: float,
  textEvidence: string,
  contextBefore: string,
  contextAfter: string,
  createdAt: datetime
}]->(:Event)

(:Event)-[:SIMULTANEOUS {
  confidence: float,
  textEvidence: string,
  createdAt: datetime
}]->(:Event)

(:Event)-[:LONG_BEFORE {
  confidence: float,
  textEvidence: string,
  estimatedGap: string,        // "years", "decades", etc.
  createdAt: datetime
}]->(:Event)

(:Event)-[:SHORTLY_AFTER {
  confidence: float,
  textEvidence: string,
  estimatedGap: string,        // "days", "weeks", etc.
  createdAt: datetime
}]->(:Event)

// Structural Relationships
(:Event)-[:OCCURS_IN]->(:Novel)
(:Event)-[:FOUND_IN]->(:Chunk)
(:Chunk)-[:PART_OF]->(:Novel)
(:Chunk)-[:FOLLOWS]->(:Chunk)
```

### Sample Queries
```cypher
// Find all events in chronological order
MATCH (e:Event)
WHERE e.absoluteDate IS NOT NULL
RETURN e
ORDER BY e.absoluteDate;

// Find timeline conflicts
MATCH (e1:Event)-[r1:BEFORE]->(e2:Event)
WHERE e1.absoluteDate > e2.absoluteDate
RETURN e1, r1, e2;

// Get event context with relationships
MATCH (e:Event {id: $eventId})
OPTIONAL MATCH (e)-[r1:BEFORE]->(after:Event)
OPTIONAL MATCH (before:Event)-[r2:BEFORE]->(e)
RETURN e, collect(before) as beforeEvents, collect(after) as afterEvents;

// Find events without dates
MATCH (e:Event)
WHERE e.absoluteDate IS NULL
RETURN e;
```

## Database Layer Interface

### Repository Pattern
```typescript
export interface IEventRepository {
  create(event: IEvent): Promise<string>;
  findById(id: string): Promise<IEventNode | null>;
  findByNovel(novelNumber: number): Promise<IEventNode[]>;
  findByChunk(chunkId: string): Promise<IEventNode[]>;
  update(id: string, updates: Partial<IEvent>): Promise<void>;
  delete(id: string): Promise<void>;
  addRelationship(relationship: ITemporalRelationship): Promise<void>;
  findConflicts(): Promise<ITimelineConflict[]>;
  search(query: string): Promise<IEventNode[]>;
}

export interface INovelRepository {
  create(novel: INovel): Promise<string>;
  findById(id: string): Promise<INovel | null>;
  findByNumber(novelNumber: number): Promise<INovel | null>;
  updateStatus(id: string, status: INovel['status']): Promise<void>;
  findAll(): Promise<INovel[]>;
}

export interface IAgentLogRepository {
  log(entry: IAgentLog): Promise<void>;
  getConversation(context: Partial<IAgentLog['context']>): Promise<IAgentLog[]>;
  getAllLogs(limit?: number): Promise<IAgentLog[]>;
  getLogsByAgent(agentType: AgentType): Promise<IAgentLog[]>;
}
```

### Service Layer Models
```typescript
export interface IProcessingJob {
  id: string;
  novelId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  currentStep: 'chunking' | 'event_detection' | 'date_assignment' | 'relationship_assignment';
  progress: {
    totalChunks: number;
    processedChunks: number;
    eventsFound: number;
    relationshipsCreated: number;
  };
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface ITimelineConflict {
  id: string;
  type: 'date_mismatch' | 'circular_dependency' | 'impossible_sequence';
  severity: 'low' | 'medium' | 'high';
  description: string;
  involvedEvents: string[];           // Event IDs
  suggestedResolution?: string;
  detectedAt: Date;
}

export interface IProcessingResult {
  novelId: string;
  eventsDetected: number;
  datesExtracted: number;
  relationshipsCreated: number;
  conflictsFound: number;
  processingTime: number;
  agentLogs: IAgentLog[];
  errors: string[];
  warnings: string[];
}
```

## Validation Schemas

### Event Validation
```typescript
import Joi from 'joi';

export const eventSchema = Joi.object({
  id: Joi.string().uuid().required(),
  name: Joi.string().min(1).max(200).required(),
  description: Joi.string().min(1).max(1000).required(),
  novelNumber: Joi.number().integer().min(1).max(5).required(),
  chunkNumber: Joi.number().integer().min(0).required(),
  characterStart: Joi.number().integer().min(0).required(),
  characterEnd: Joi.number().integer().min(Joi.ref('characterStart')).required(),
  quotedText: Joi.string().min(1).max(2000).required(),
  csvRowId: Joi.string().optional(),
  confidence: Joi.number().min(0).max(1).required()
});

export const temporalRelationshipSchema = Joi.object({
  id: Joi.string().uuid().required(),
  sourceEventId: Joi.string().uuid().required(),
  targetEventId: Joi.string().uuid().required(),
  type: Joi.string().valid(...Object.values(RelationshipType)).required(),
  confidence: Joi.number().min(0).max(1).required(),
  textEvidence: Joi.string().min(1).max(500).required(),
  contextBefore: Joi.string().max(200).optional(),
  contextAfter: Joi.string().max(200).optional()
});
```

### File Upload Validation
```typescript
export const uploadValidation = {
  docx: {
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ],
    maxSize: 50 * 1024 * 1024, // 50MB
    extensions: ['.docx']
  },
  csv: {
    mimeTypes: ['text/csv', 'application/csv'],
    maxSize: 10 * 1024 * 1024, // 10MB  
    extensions: ['.csv']
  }
};
```

## API Data Transfer Objects

### Request DTOs
```typescript
export interface ProcessNovelRequest {
  novelFile: File;
  eventsFile: File;
  novelNumber: number;
  options: {
    chunkSize?: number;
    chunkOverlap?: number;
    llmModel?: string;
    temperature?: number;
  };
}

export interface QueryEventsRequest {
  novelNumber?: number;
  eventName?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  hasConflicts?: boolean;
  limit?: number;
  offset?: number;
}
```

### Response DTOs
```typescript
export interface ProcessNovelResponse {
  jobId: string;
  status: 'started';
  estimatedDuration: number;
}

export interface EventResponse {
  id: string;
  name: string;
  description: string;
  novelNumber: number;
  quotedText: string;
  absoluteDate?: string;
  relationships: {
    before: EventSummary[];
    after: EventSummary[];
    simultaneous: EventSummary[];
  };
  conflicts: ConflictSummary[];
}

export interface EventSummary {
  id: string;
  name: string;
  confidence: number;
}

export interface ConflictSummary {
  type: string;
  severity: string;
  description: string;
}
```

These data models provide a complete foundation for the graph-based novel analysis system, ensuring type safety, data integrity, and clear interfaces between all system components.