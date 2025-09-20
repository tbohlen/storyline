# Shared Technical Standards

## Code Style and Quality

### TypeScript Configuration
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext", 
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### ESLint Rules
```javascript
module.exports = {
  extends: [
    '@typescript-eslint/recommended',
    'airbnb-base',
    'prettier'
  ],
  rules: {
    'no-console': 'warn',
    'prefer-const': 'error', 
    'no-var': 'error',
    '@typescript-eslint/no-unused-vars': 'error',
    'max-len': ['error', { code: 100 }]
  }
}
```

### File Naming Conventions
- **Files**: `kebab-case.ts` (e.g., `event-detector.ts`)
- **Classes**: `PascalCase` (e.g., `EventDetector`)
- **Functions**: `camelCase` (e.g., `extractEventsFromChunk`)
- **Constants**: `SCREAMING_SNAKE_CASE` (e.g., `MAX_CHUNK_SIZE`)
- **Interfaces**: `PascalCase` with `I` prefix (e.g., `IEventNode`)

## Project Structure Pattern

```
src/
├── config/
│   ├── database.ts
│   ├── llm-providers.ts
│   └── environment.ts
├── models/
│   ├── event.ts
│   ├── novel.ts
│   └── agent-log.ts
├── services/
│   ├── document-processor.ts
│   ├── graph-database.ts
│   └── llm-client.ts
├── agents/
│   ├── base-agent.ts
│   ├── event-detector.ts
│   ├── date-assigner.ts
│   └── relationship-assigner.ts
├── utils/
│   ├── logger.ts
│   ├── validators.ts
│   └── file-helpers.ts
├── routes/
│   ├── api/
│   └── websocket/
├── middleware/
│   ├── auth.ts
│   ├── rate-limit.ts
│   └── error-handler.ts
└── tests/
    ├── unit/
    ├── integration/
    └── fixtures/
```

## Error Handling Standards

### Error Types
```typescript
export class BaseError extends Error {
  constructor(
    public message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class DocumentProcessingError extends BaseError {
  constructor(message: string, public filename: string) {
    super(message, 'DOCUMENT_PROCESSING_ERROR', 422);
  }
}

export class LLMError extends BaseError {
  constructor(message: string, public provider: string) {
    super(message, 'LLM_ERROR', 503);
  }
}

export class DatabaseError extends BaseError {
  constructor(message: string, public operation: string) {
    super(message, 'DATABASE_ERROR', 500);
  }
}
```

### Error Handling Pattern
```typescript
// Service layer error handling
async function processDocument(filename: string): Promise<ProcessedDocument> {
  try {
    const content = await extractText(filename);
    return await parseContent(content);
  } catch (error) {
    logger.error('Document processing failed', { 
      filename, 
      error: error.message 
    });
    throw new DocumentProcessingError(
      `Failed to process ${filename}: ${error.message}`,
      filename
    );
  }
}

// Route layer error handling  
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof BaseError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message
      }
    });
  } else {
    logger.error('Unhandled error', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false, 
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      }
    });
  }
});
```

## Logging Standards

### Logger Configuration
```typescript
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});
```

### Logging Patterns
```typescript
// Service operations
logger.info('Starting document processing', { 
  filename: novel.filename,
  chunkCount: chunks.length 
});

// LLM API calls
logger.debug('LLM request', {
  provider: 'openai',
  model: 'gpt-4',
  promptLength: prompt.length,
  maxTokens: 1000
});

// Database operations
logger.info('Created event node', {
  eventId: event.id,
  novelNumber: event.novelNumber,
  chunkNumber: event.chunkNumber
});

// Error logging
logger.error('Event detection failed', {
  chunkId: chunk.id,
  error: error.message,
  retryAttempt: attemptNumber
});
```

## Database Interaction Patterns

### Neo4j Query Wrapper
```typescript
export class GraphDatabase {
  private driver: Driver;

  async runQuery<T>(
    query: string, 
    parameters: Record<string, any> = {}
  ): Promise<T[]> {
    const session = this.driver.session();
    try {
      logger.debug('Executing Neo4j query', { query, parameters });
      const result = await session.run(query, parameters);
      return result.records.map(record => record.toObject() as T);
    } catch (error) {
      logger.error('Neo4j query failed', { query, parameters, error: error.message });
      throw new DatabaseError(`Query failed: ${error.message}`, 'runQuery');
    } finally {
      await session.close();
    }
  }

  async createEventNode(event: IEventNode): Promise<void> {
    const query = `
      CREATE (e:Event {
        id: $id,
        name: $name,
        description: $description,
        novelNumber: $novelNumber,
        chunkNumber: $chunkNumber,
        characterStart: $characterStart,
        characterEnd: $characterEnd,
        quotedText: $quotedText
      })
    `;
    await this.runQuery(query, event);
    logger.info('Created event node', { eventId: event.id });
  }
}
```

## LLM Integration Patterns

### Base LLM Client
```typescript
export interface ILLMProvider {
  name: string;
  generateCompletion(prompt: string, options?: LLMOptions): Promise<string>;
  generateStructuredOutput<T>(prompt: string, schema: JsonSchema): Promise<T>;
}

export abstract class BaseLLMClient implements ILLMProvider {
  abstract name: string;
  
  protected async makeRequest(
    prompt: string, 
    options: LLMOptions
  ): Promise<string> {
    const startTime = Date.now();
    try {
      logger.debug('LLM request started', { 
        provider: this.name,
        promptLength: prompt.length,
        options
      });
      
      const response = await this.callAPI(prompt, options);
      
      logger.info('LLM request completed', {
        provider: this.name,
        duration: Date.now() - startTime,
        responseLength: response.length
      });
      
      return response;
    } catch (error) {
      logger.error('LLM request failed', {
        provider: this.name,
        duration: Date.now() - startTime,
        error: error.message
      });
      throw new LLMError(`${this.name} request failed: ${error.message}`, this.name);
    }
  }
  
  protected abstract callAPI(prompt: string, options: LLMOptions): Promise<string>;
}
```

### Retry Logic Pattern
```typescript
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      logger.warn('Operation failed, retrying', {
        attempt,
        maxAttempts,
        error: error.message
      });
      
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }
  }
  
  throw lastError;
}
```

## Testing Standards

### Unit Test Structure
```typescript
describe('EventDetector', () => {
  let eventDetector: EventDetector;
  let mockLLMClient: jest.Mocked<ILLMProvider>;
  let mockDatabase: jest.Mocked<GraphDatabase>;

  beforeEach(() => {
    mockLLMClient = createMockLLMClient();
    mockDatabase = createMockDatabase();
    eventDetector = new EventDetector(mockLLMClient, mockDatabase);
  });

  describe('detectEventsInChunk', () => {
    it('should detect events and create graph nodes', async () => {
      // Arrange
      const chunk = createTestChunk();
      const expectedEvent = createTestEvent();
      mockLLMClient.generateStructuredOutput.mockResolvedValue(expectedEvent);

      // Act
      const result = await eventDetector.detectEventsInChunk(chunk);

      // Assert
      expect(result).toEqual(expectedEvent);
      expect(mockDatabase.createEventNode).toHaveBeenCalledWith(expectedEvent);
    });

    it('should handle LLM errors gracefully', async () => {
      // Arrange
      const chunk = createTestChunk();
      mockLLMClient.generateStructuredOutput.mockRejectedValue(
        new Error('API rate limit')
      );

      // Act & Assert
      await expect(eventDetector.detectEventsInChunk(chunk))
        .rejects.toThrow(LLMError);
    });
  });
});
```

### Integration Test Patterns
```typescript
describe('Document Processing Integration', () => {
  let app: Application;
  let testDatabase: GraphDatabase;

  beforeAll(async () => {
    app = await createTestApp();
    testDatabase = new GraphDatabase(TEST_NEO4J_URL);
  });

  afterEach(async () => {
    await testDatabase.clearAll();
  });

  it('should process complete novel workflow', async () => {
    // Arrange
    const testNovel = await uploadTestFile('test-novel.docx');
    const eventsCSV = await uploadTestFile('test-events.csv');

    // Act
    const response = await request(app)
      .post('/api/process-novel')
      .field('novelFile', testNovel)
      .field('eventsFile', eventsCSV)
      .expect(200);

    // Assert
    expect(response.body.success).toBe(true);
    const events = await testDatabase.getAllEvents();
    expect(events).toHaveLength(5);
  });
});
```

## Configuration Management

### Environment Variables
```typescript
export const config = {
  server: {
    port: Number(process.env.PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development'
  },
  database: {
    neo4jUri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    neo4jUser: process.env.NEO4J_USER || 'neo4j',
    neo4jPassword: process.env.NEO4J_PASSWORD || 'password'
  },
  llm: {
    openaiKey: process.env.OPENAI_API_KEY,
    anthropicKey: process.env.ANTHROPIC_API_KEY,
    maxTokens: Number(process.env.LLM_MAX_TOKENS) || 4000,
    temperature: Number(process.env.LLM_TEMPERATURE) || 0.1
  },
  processing: {
    maxChunkSize: Number(process.env.MAX_CHUNK_SIZE) || 2000,
    chunkOverlap: Number(process.env.CHUNK_OVERLAP) || 200,
    maxConcurrentProcessing: Number(process.env.MAX_CONCURRENT) || 3
  }
};

// Validation
const requiredEnvVars = ['NEO4J_URI', 'OPENAI_API_KEY'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Required environment variable ${envVar} is not set`);
  }
}
```

## API Response Standards

### Success Response Format
```typescript
interface SuccessResponse<T> {
  success: true;
  data: T;
  metadata?: {
    timestamp: string;
    requestId: string;
    processingTime: number;
  };
}
```

### Error Response Format  
```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: string;
    requestId: string;
  };
}
```

### WebSocket Event Format
```typescript
interface WebSocketEvent {
  type: 'agent_prompt' | 'agent_response' | 'processing_update' | 'error';
  timestamp: string;
  data: {
    agentType: string;
    content: string;
    context?: any;
  };
}
```

These standards ensure consistency across all phases of development and make the codebase maintainable, testable, and scalable.