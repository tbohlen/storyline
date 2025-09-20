# Phase 1: Core Infrastructure & Database Setup

## Objective
Establish the foundational infrastructure including Neo4j database setup, Express server framework, configuration management, and core utilities that will support all subsequent phases.

## Technical Requirements

### Dependencies to Install
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "neo4j-driver": "^5.14.0",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "morgan": "^1.10.0",
    "winston": "^3.11.0", 
    "joi": "^17.11.0",
    "uuid": "^9.0.1",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/morgan": "^1.9.9",
    "@types/uuid": "^9.0.7",
    "typescript": "^5.2.2",
    "ts-node": "^10.9.1",
    "nodemon": "^3.0.2",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.8"
  }
}
```

## Core Components to Implement

### 1. Database Connection and Setup
**File**: `src/config/database.ts`

Create Neo4j connection manager with:
- Connection pooling
- Health check functionality  
- Graceful shutdown handling
- Query execution wrapper with error handling
- Transaction management

```typescript
export class DatabaseManager {
  private driver: Driver;
  
  async connect(): Promise<void>;
  async disconnect(): Promise<void>;
  async healthCheck(): Promise<boolean>;
  async runQuery<T>(query: string, params: Record<string, any>): Promise<T[]>;
  async runTransaction(queries: TransactionQuery[]): Promise<void>;
}
```

### 2. Express Server Foundation
**File**: `src/server.ts`

Set up Express application with:
- CORS configuration
- Security middleware (Helmet)
- Request logging (Morgan)
- Error handling middleware
- Health check endpoints
- Graceful shutdown handling

```typescript
export class Server {
  private app: Express;
  private server: http.Server;
  
  async start(): Promise<void>;
  async stop(): Promise<void>;
  private setupMiddleware(): void;
  private setupRoutes(): void;
  private setupErrorHandling(): void;
}
```

### 3. Configuration Management
**File**: `src/config/environment.ts`

Environment-based configuration with validation:
- Database connection settings
- Server configuration  
- LLM API settings (for later phases)
- Processing parameters
- Security settings

```typescript
interface Config {
  server: ServerConfig;
  database: DatabaseConfig;
  llm: LLMConfig;
  processing: ProcessingConfig;
}

export const config: Config;
export function validateConfig(): void;
```

### 4. Logging System
**File**: `src/utils/logger.ts`

Winston-based logging with:
- Structured JSON logging
- Multiple log levels
- File and console outputs
- Request ID tracking
- Performance logging

```typescript
export interface Logger {
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;  
  error(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}

export const logger: Logger;
```

### 5. Error Handling Framework
**File**: `src/utils/errors.ts`

Custom error classes and handling:
- Base error classes with status codes
- Domain-specific error types
- Error serialization for API responses
- Global error handler middleware

```typescript
export class BaseError extends Error;
export class DatabaseError extends BaseError;
export class ValidationError extends BaseError;
export class ConfigurationError extends BaseError;

export function handleError(error: Error): ErrorResponse;
```

### 6. Validation Utilities
**File**: `src/utils/validation.ts`

Joi-based validation with:
- Common validation schemas
- Request validation middleware
- Data sanitization helpers
- Custom validation rules

```typescript
export const commonSchemas: {
  uuid: Joi.StringSchema;
  novelNumber: Joi.NumberSchema;
  confidence: Joi.NumberSchema;
};

export function validateRequest(schema: Joi.Schema): RequestHandler;
```

## Database Schema Creation

### Neo4j Initial Setup
**File**: `src/database/schema.cypher`

Create constraints and indexes:
```cypher
// Create unique constraints
CREATE CONSTRAINT event_id IF NOT EXISTS FOR (e:Event) REQUIRE e.id IS UNIQUE;
CREATE CONSTRAINT novel_id IF NOT EXISTS FOR (n:Novel) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT chunk_id IF NOT EXISTS FOR (c:Chunk) REQUIRE c.id IS UNIQUE;

// Create indexes for performance
CREATE INDEX event_novel_number IF NOT EXISTS FOR (e:Event) ON (e.novelNumber);
CREATE INDEX event_chunk_number IF NOT EXISTS FOR (e:Event) ON (e.chunkNumber);
CREATE INDEX novel_number IF NOT EXISTS FOR (n:Novel) ON (n.novelNumber);
```

### Database Initialization Script
**File**: `src/database/init.ts`

Automated schema setup:
- Run schema creation queries
- Verify constraints are created
- Create initial system data if needed
- Database migration support

```typescript
export class DatabaseInitializer {
  async initializeSchema(): Promise<void>;
  async verifySchema(): Promise<boolean>;
  async runMigrations(): Promise<void>;
}
```

## Testing Infrastructure

### Test Database Setup
**File**: `src/tests/setup.ts`

Test environment configuration:
- Separate test database instance
- Database cleanup between tests
- Test data factories
- Mock configuration

### Unit Test Examples
**File**: `src/tests/unit/database.test.ts`

Test database connection and queries:
```typescript
describe('DatabaseManager', () => {
  let dbManager: DatabaseManager;
  
  beforeAll(async () => {
    dbManager = new DatabaseManager(TEST_CONFIG);
    await dbManager.connect();
  });
  
  it('should execute simple queries', async () => {
    const result = await dbManager.runQuery('RETURN 1 as number');
    expect(result[0].number).toBe(1);
  });
  
  it('should handle query errors gracefully', async () => {
    await expect(dbManager.runQuery('INVALID CYPHER'))
      .rejects.toThrow(DatabaseError);
  });
});
```

## API Foundation

### Health Check Endpoints
**File**: `src/routes/health.ts`

System status endpoints:
- `/health` - Basic server health
- `/health/database` - Database connectivity
- `/health/detailed` - Full system status

```typescript
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/health/database', async (req, res) => {
  const isHealthy = await dbManager.healthCheck();
  res.status(isHealthy ? 200 : 503).json({ 
    database: isHealthy ? 'connected' : 'disconnected' 
  });
});
```

### Base API Structure
**File**: `src/routes/api/index.ts`

API route organization:
- Version prefixing (`/api/v1`)
- Route module registration
- Standard response formatting
- Request/response logging

## Docker Configuration

### Development Docker Compose
**File**: `docker-compose.dev.yml`

Multi-service development environment:
```yaml
version: '3.8'
services:
  neo4j:
    image: neo4j:5.13
    environment:
      NEO4J_AUTH: neo4j/development
      NEO4J_PLUGINS: '["apoc"]'
    ports:
      - "7474:7474"
      - "7687:7687"
    volumes:
      - neo4j_data:/data

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: development
      NEO4J_URI: bolt://neo4j:7687
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      - neo4j

volumes:
  neo4j_data:
```

### Application Dockerfile
**File**: `Dockerfile`

Optimized Node.js container:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

## Performance Monitoring

### Basic Metrics Collection
**File**: `src/utils/metrics.ts`

Application metrics tracking:
- Request duration and count
- Database query performance
- Memory and CPU usage
- Custom business metrics

```typescript
export interface Metrics {
  recordRequest(method: string, route: string, duration: number): void;
  recordDatabaseQuery(query: string, duration: number): void;
  getMetrics(): MetricsSnapshot;
}
```

## Development Scripts

### Package.json Scripts
```json
{
  "scripts": {
    "dev": "nodemon src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src/**/*.ts",
    "db:init": "ts-node src/database/init.ts",
    "db:reset": "ts-node src/database/reset.ts"
  }
}
```

## Acceptance Criteria

### Functional Requirements
- ✅ Neo4j database connects successfully
- ✅ Express server starts and responds to health checks
- ✅ Configuration loads from environment variables
- ✅ Logging writes to both console and files
- ✅ Error handling returns proper HTTP status codes
- ✅ Database schema creates without errors

### Performance Requirements  
- ✅ Server startup time under 5 seconds
- ✅ Health check responses under 100ms
- ✅ Database queries execute within timeout limits
- ✅ Memory usage stable under load

### Quality Requirements
- ✅ 100% test coverage for core utilities
- ✅ All TypeScript strict mode checks pass
- ✅ ESLint rules pass without warnings
- ✅ Docker containers build and run successfully

## Deliverables

1. **Core Infrastructure**
   - Database connection manager
   - Express server with middleware
   - Configuration management
   - Logging and error handling

2. **Development Environment**
   - Docker Compose setup
   - Database initialization scripts
   - Development scripts and tooling

3. **Testing Foundation**
   - Test database setup
   - Unit test examples
   - CI/CD configuration

4. **Documentation**
   - API endpoint documentation
   - Database schema documentation
   - Setup and deployment instructions

This phase creates a solid foundation that supports high code quality, maintainability, and scalability for all subsequent development phases.