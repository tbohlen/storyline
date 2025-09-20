# Testing Template and Patterns

## Overview
This document provides comprehensive testing patterns, templates, and best practices for the Novel Event Timeline Analysis System. It ensures consistent testing approaches across all modules and phases.

## Testing Strategy

### Testing Pyramid
```
    E2E Tests (5%)
   ┌─────────────────┐
   │ User Workflows  │
   └─────────────────┘
  Integration Tests (15%)
 ┌─────────────────────┐
 │ API & Service Tests │
 └─────────────────────┘
      Unit Tests (80%)
    ┌─────────────────────┐
    │ Individual Functions │
    │ Classes & Methods    │
    └─────────────────────┘
```

### Test Categories
1. **Unit Tests**: Test individual functions, classes, and methods in isolation
2. **Integration Tests**: Test interactions between modules, API endpoints, and database operations
3. **End-to-End Tests**: Test complete user workflows from frontend to database
4. **Performance Tests**: Test system performance under load
5. **Contract Tests**: Test API contracts and data schemas

## Test Configuration

### Jest Configuration
**File**: `jest.config.js`

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.spec.ts',
    '**/tests/**/*.test.ts',
    '**/tests/**/*.spec.ts'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/tests/**',
    '!src/**/__tests__/**',
    '!src/types/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
  testTimeout: 30000,
  verbose: true,
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  }
};
```

### Test Setup
**File**: `src/tests/setup.ts`

```typescript
import { config } from 'dotenv';
import { DatabaseManager } from '../config/database';
import { logger } from '../utils/logger';

// Load test environment variables
config({ path: '.env.test' });

// Global test configuration
const TEST_CONFIG = {
  database: {
    uri: process.env.TEST_NEO4J_URI || 'bolt://localhost:7687',
    user: process.env.TEST_NEO4J_USER || 'neo4j',
    password: process.env.TEST_NEO4J_PASSWORD || 'test'
  },
  timeout: 30000,
  retryAttempts: 3
};

// Global test database instance
let testDatabase: DatabaseManager;

// Setup before all tests
beforeAll(async () => {
  try {
    testDatabase = new DatabaseManager(TEST_CONFIG.database);
    await testDatabase.connect();
    await setupTestData();
    logger.info('Test setup completed');
  } catch (error) {
    logger.error('Test setup failed', { error: error.message });
    throw error;
  }
}, TEST_CONFIG.timeout);

// Cleanup after all tests
afterAll(async () => {
  try {
    await cleanupTestData();
    await testDatabase.disconnect();
    logger.info('Test cleanup completed');
  } catch (error) {
    logger.error('Test cleanup failed', { error: error.message });
  }
});

// Setup test data
async function setupTestData(): Promise<void> {
  await testDatabase.runQuery('CREATE CONSTRAINT test_event_id IF NOT EXISTS FOR (e:Event) REQUIRE e.id IS UNIQUE');
  // Add other test data setup
}

// Cleanup test data
async function cleanupTestData(): Promise<void> {
  await testDatabase.runQuery('MATCH (n) DETACH DELETE n');
}

// Export test utilities
export { testDatabase, TEST_CONFIG };
```

## Unit Test Templates

### Basic Class Testing Template
**File**: `src/tests/unit/example-service.test.ts`

```typescript
import { ExampleService, ExampleServiceConfig } from '../../services/example-service';
import { createMockLogger, createMockDatabase } from '../mocks';
import { ValidationError, ProcessingError } from '../../utils/errors';

describe('ExampleService', () => {
  let service: ExampleService;
  let mockLogger: jest.Mocked<Logger>;
  let mockDatabase: jest.Mocked<DatabaseManager>;
  let defaultConfig: ExampleServiceConfig;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockDatabase = createMockDatabase();
    defaultConfig = {
      maxRetries: 3,
      timeout: 5000,
      enableCaching: true
    };
    
    service = new ExampleService(defaultConfig, {
      logger: mockLogger,
      database: mockDatabase
    });
  });

  afterEach(async () => {
    await service.cleanup();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const service = new ExampleService();
      expect(service.getConfig()).toMatchObject({
        maxRetries: 3,
        timeout: 30000,
        enableCaching: false
      });
    });

    it('should merge provided configuration with defaults', () => {
      const customConfig = { maxRetries: 5 };
      const service = new ExampleService(customConfig);
      const config = service.getConfig();
      
      expect(config.maxRetries).toBe(5);
      expect(config.timeout).toBe(30000); // default value
    });

    it('should validate configuration on creation', () => {
      expect(() => new ExampleService({ maxRetries: -1 }))
        .toThrow('maxRetries must be non-negative');
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      mockDatabase.healthCheck.mockResolvedValue(true);
      
      await expect(service.initialize()).resolves.not.toThrow();
      expect(mockDatabase.connect).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('initialized successfully')
      );
    });

    it('should throw error if database connection fails', async () => {
      mockDatabase.connect.mockRejectedValue(new Error('Connection failed'));
      
      await expect(service.initialize()).rejects.toThrow('Connection failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('processData', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should process valid data successfully', async () => {
      const input = { data: 'test data', options: { validate: true } };
      const expectedResult = { processed: true, value: 'TEST DATA' };
      
      mockDatabase.runQuery.mockResolvedValue([expectedResult]);
      
      const result = await service.processData(input);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(expectedResult);
      expect(result.metadata.processingTime).toBeGreaterThan(0);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('processing completed')
      );
    });

    it('should handle validation errors', async () => {
      const invalidInput = { data: '', options: {} };
      
      const result = await service.processData(invalidInput);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid input');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should retry on transient failures', async () => {
      const input = { data: 'test data', options: {} };
      
      mockDatabase.runQuery
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValue([{ success: true }]);
      
      const result = await service.processData(input);
      
      expect(result.success).toBe(true);
      expect(mockDatabase.runQuery).toHaveBeenCalledTimes(3);
      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries exceeded', async () => {
      const input = { data: 'test data', options: {} };
      
      mockDatabase.runQuery.mockRejectedValue(new Error('Persistent failure'));
      
      const result = await service.processData(input);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Persistent failure');
      expect(mockDatabase.runQuery).toHaveBeenCalledTimes(3); // maxRetries
    });

    it('should use cache when enabled', async () => {
      const input = { data: 'test data', options: { useCache: true } };
      const cachedResult = { cached: true };
      
      // First call - cache miss
      mockDatabase.runQuery.mockResolvedValue([cachedResult]);
      const result1 = await service.processData(input);
      
      // Second call - cache hit
      const result2 = await service.processData(input);
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(mockDatabase.runQuery).toHaveBeenCalledTimes(1); // Only first call
    });
  });

  describe('getStats', () => {
    it('should return current statistics', async () => {
      await service.initialize();
      
      const stats = service.getStats();
      
      expect(stats).toMatchObject({
        isInitialized: true,
        cacheSize: 0,
        requestCount: 0,
        errorCount: 0
      });
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources properly', async () => {
      await service.initialize();
      await service.cleanup();
      
      expect(mockDatabase.disconnect).toHaveBeenCalled();
      expect(service.getStats().isInitialized).toBe(false);
    });
  });
});
```

### AI Agent Testing Template
**File**: `src/tests/unit/event-detector.test.ts`

```typescript
import { EventDetector } from '../../agents/event-detector';
import { createMockLLMClient, createMockEventRepository } from '../mocks';
import { ITextChunk, EventCSVRow, DetectedEvent } from '../../types';

describe('EventDetector', () => {
  let detector: EventDetector;
  let mockLLMClient: jest.Mocked<ILLMProvider>;
  let mockEventRepository: jest.Mocked<IEventRepository>;

  beforeEach(() => {
    mockLLMClient = createMockLLMClient();
    mockEventRepository = createMockEventRepository();
    detector = new EventDetector(mockLLMClient, {
      model: 'gpt-4',
      temperature: 0.1,
      maxTokens: 4000,
      retryAttempts: 3,
      retryDelay: 1000
    });
  });

  describe('process', () => {
    it('should detect events from text chunk', async () => {
      const chunk = createTestChunk('The hero defeated the mighty dragon in an epic battle that lasted three days.');
      const eventsReference = [createTestEventReference('Dragon Battle', 'Epic fight with dragon')];
      const mockDetectedEvent: DetectedEvent = {
        eventName: 'Dragon Battle',
        description: 'Epic fight with dragon',
        csvRowId: eventsReference[0].eventId,
        textEvidence: 'The hero defeated the mighty dragon in an epic battle',
        confidence: 0.9,
        reasoning: 'Clear description of dragon battle matching CSV reference',
        isNewEvent: false
      };

      mockLLMClient.generateStructuredOutput.mockResolvedValue([mockDetectedEvent]);
      mockEventRepository.createDetectedEvent.mockResolvedValue('event-123');

      const result = await detector.process({
        chunk,
        eventsReference,
        novelContext: { previousEvents: [] }
      }, createTestContext());

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        eventName: 'Dragon Battle',
        confidence: 0.9,
        isNewEvent: false
      });
      expect(mockEventRepository.createDetectedEvent).toHaveBeenCalled();
    });

    it('should handle LLM API failures gracefully', async () => {
      const chunk = createTestChunk('Some text');
      
      mockLLMClient.generateStructuredOutput.mockRejectedValue(
        new Error('API rate limit exceeded')
      );

      const result = await detector.process({
        chunk,
        eventsReference: [],
        novelContext: { previousEvents: [] }
      }, createTestContext());

      expect(result.success).toBe(false);
      expect(result.errors).toContain('API rate limit exceeded');
      expect(result.tokensUsed).toBe(0);
    });

    it('should filter low confidence events', async () => {
      const chunk = createTestChunk('Ambiguous text that might contain events');
      const lowConfidenceEvent: DetectedEvent = {
        eventName: 'Unclear Event',
        description: 'Something happened',
        textEvidence: 'ambiguous text',
        confidence: 0.3, // Below threshold
        reasoning: 'Very unclear what happened',
        isNewEvent: true
      };

      mockLLMClient.generateStructuredOutput.mockResolvedValue([lowConfidenceEvent]);

      const result = await detector.process({
        chunk,
        eventsReference: [],
        novelContext: { previousEvents: [] }
      }, createTestContext());

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0); // Filtered out due to low confidence
      expect(result.warnings).toContain('Event filtered due to low confidence');
    });

    it('should create new events for unmatched references', async () => {
      const chunk = createTestChunk('After the mysterious ceremony, the hero gained new powers.');
      const newEvent: DetectedEvent = {
        eventName: 'Mysterious Ceremony',
        description: 'A ceremony that gave the hero new powers',
        textEvidence: 'the mysterious ceremony',
        confidence: 0.8,
        reasoning: 'Clear reference to significant ceremony not in CSV',
        isNewEvent: true
      };

      mockLLMClient.generateStructuredOutput.mockResolvedValue([newEvent]);
      mockEventRepository.createDetectedEvent.mockResolvedValue('new-event-456');

      const result = await detector.process({
        chunk,
        eventsReference: [],
        novelContext: { previousEvents: [] }
      }, createTestContext());

      expect(result.success).toBe(true);
      expect(result.data[0].isNewEvent).toBe(true);
      expect(mockEventRepository.createDetectedEvent).toHaveBeenCalledWith(
        expect.objectContaining({ isNewEvent: true }),
        expect.any(Object)
      );
    });
  });

  describe('buildDetectionPrompt', () => {
    it('should build contextual prompt with previous events', () => {
      const chunk = createTestChunk('Test content');
      const eventsReference = [createTestEventReference('Event 1')];
      const previousEvents = [createTestDetectedEvent('Previous Event')];

      const prompt = detector.buildDetectionPrompt(chunk, eventsReference, previousEvents);

      expect(prompt).toContain('Test content');
      expect(prompt).toContain('Event 1');
      expect(prompt).toContain('Previous Event');
      expect(prompt).toContain('JSON array');
    });
  });

  describe('calculateTextPosition', () => {
    it('should calculate accurate character positions', () => {
      const chunk = createTestChunk('The quick brown fox jumps over the lazy dog.');
      const evidence = 'brown fox jumps';

      const position = detector.calculateTextPosition(evidence, chunk);

      expect(position.start).toBe(10); // Position of 'brown'
      expect(position.end).toBe(25);   // End of 'jumps'
    });

    it('should handle text not found in chunk', () => {
      const chunk = createTestChunk('Some text content');
      const evidence = 'not found text';

      expect(() => detector.calculateTextPosition(evidence, chunk))
        .toThrow('Text evidence not found in chunk');
    });
  });
});
```

## Integration Test Templates

### API Integration Test Template
**File**: `src/tests/integration/event-detection-api.test.ts`

```typescript
import request from 'supertest';
import { app } from '../../server';
import { testDatabase } from '../setup';
import { createTestNovel, createTestChunks, createTestEventsCSV } from '../fixtures';

describe('Event Detection API Integration', () => {
  let testNovelId: string;
  let testChunks: ITextChunk[];

  beforeEach(async () => {
    // Setup test data
    const novel = await createTestNovel();
    testNovelId = novel.id;
    testChunks = await createTestChunks(testNovelId, 5);
    
    // Ensure clean database state
    await testDatabase.runQuery('MATCH (e:Event {novelId: $novelId}) DETACH DELETE e', {
      novelId: testNovelId
    });
  });

  afterEach(async () => {
    // Cleanup test data
    await testDatabase.runQuery('MATCH (n {novelId: $novelId}) DETACH DELETE n', {
      novelId: testNovelId
    });
  });

  describe('POST /api/v1/events/detect/:novelId', () => {
    it('should start event detection process', async () => {
      const response = await request(app)
        .post(`/api/v1/events/detect/${testNovelId}`)
        .send({
          maxConcurrency: 1,
          batchSize: 2,
          llmProvider: 'openai'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        novelId: testNovelId,
        status: 'starting',
        totalChunks: testChunks.length
      });
    });

    it('should validate request parameters', async () => {
      const response = await request(app)
        .post(`/api/v1/events/detect/${testNovelId}`)
        .send({
          maxConcurrency: 0, // Invalid
          batchSize: -1      // Invalid
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('validation');
    });

    it('should handle non-existent novel', async () => {
      const fakeNovelId = 'non-existent-id';
      
      const response = await request(app)
        .post(`/api/v1/events/detect/${fakeNovelId}`)
        .send({
          maxConcurrency: 1,
          batchSize: 5
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Novel not found');
    });
  });

  describe('GET /api/v1/events/progress/:novelId', () => {
    it('should return processing progress', async () => {
      // Start processing
      await request(app)
        .post(`/api/v1/events/detect/${testNovelId}`)
        .send({ maxConcurrency: 1, batchSize: 2 });

      // Check progress
      const response = await request(app)
        .get(`/api/v1/events/progress/${testNovelId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        novelId: testNovelId,
        totalChunks: expect.any(Number),
        processedChunks: expect.any(Number),
        status: expect.stringMatching(/starting|processing|completed/)
      });
    });
  });

  describe('GET /api/v1/events/novel/:novelId', () => {
    it('should return detected events', async () => {
      // Create some test events
      await testDatabase.runQuery(`
        CREATE (e:Event {
          id: $id,
          name: $name,
          description: $description,
          novelId: $novelId,
          confidence: $confidence
        })
      `, {
        id: 'test-event-1',
        name: 'Test Event',
        description: 'A test event',
        novelId: testNovelId,
        confidence: 0.9
      });

      const response = await request(app)
        .get(`/api/v1/events/novel/${testNovelId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({
        id: 'test-event-1',
        name: 'Test Event',
        confidence: 0.9
      });
    });

    it('should return empty array for novel with no events', async () => {
      const response = await request(app)
        .get(`/api/v1/events/novel/${testNovelId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(0);
    });
  });
});
```

### Database Integration Test Template
**File**: `src/tests/integration/event-repository.test.ts`

```typescript
import { EventRepository } from '../../repositories/event-repository';
import { testDatabase } from '../setup';
import { createTestEvent, createTestNovel } from '../fixtures';

describe('EventRepository Integration', () => {
  let repository: EventRepository;
  let testNovelId: string;

  beforeAll(async () => {
    repository = new EventRepository(testDatabase);
    const novel = await createTestNovel();
    testNovelId = novel.id;
  });

  beforeEach(async () => {
    // Clean events before each test
    await testDatabase.runQuery('MATCH (e:Event) DETACH DELETE e');
  });

  afterAll(async () => {
    // Final cleanup
    await testDatabase.runQuery('MATCH (n) DETACH DELETE n');
  });

  describe('createDetectedEvent', () => {
    it('should create event in database', async () => {
      const event = createTestEvent({
        name: 'Battle Scene',
        description: 'Epic battle between hero and villain',
        novelId: testNovelId
      });

      const eventId = await repository.createDetectedEvent(event, {
        novelId: testNovelId,
        chunkId: 'chunk-1',
        agentType: 'event_detector'
      });

      expect(eventId).toBeDefined();

      // Verify event was created
      const stored = await repository.findById(eventId);
      expect(stored).toMatchObject({
        name: 'Battle Scene',
        description: 'Epic battle between hero and villain'
      });
    });

    it('should handle database constraints', async () => {
      const event = createTestEvent({ id: 'duplicate-id' });
      
      // Create first event
      await repository.createDetectedEvent(event, createTestContext());
      
      // Try to create duplicate
      await expect(
        repository.createDetectedEvent(event, createTestContext())
      ).rejects.toThrow('already exists');
    });
  });

  describe('findByNovel', () => {
    it('should return events for specific novel', async () => {
      // Create events for different novels
      const event1 = createTestEvent({ novelNumber: 1 });
      const event2 = createTestEvent({ novelNumber: 2 });
      
      await repository.createDetectedEvent(event1, createTestContext());
      await repository.createDetectedEvent(event2, createTestContext());

      const novel