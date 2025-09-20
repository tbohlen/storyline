# Novel Event Timeline Analysis System - Master Overview

## Project Vision
Build an agentic AI workflow system that processes novels in a series, identifies major events, and creates a graph database to explore temporal relationships and detect timeline conflicts.

## System Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   DOCX Files    │    │   Events CSV     │    │  Graph Database │
│                 │    │                  │    │                 │
├─────────────────┤    ├──────────────────┤    ├─────────────────┤
│ Novel 1.docx    │    │ Event ID         │    │ Event Nodes     │
│ Novel 2.docx    │───▶│ Event Name       │───▶│ Date Properties │
│ Novel 3.docx    │    │ Description      │    │ Relationships   │
│ Novel 4.docx    │    │ Novel Number     │    │ ("before",      │
│ Novel 5.docx    │    │                  │    │  "after", etc.) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                        │
┌─────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI Agent Workflow                           │
├─────────────────┬─────────────────┬─────────────────────────────┤
│ Event Detection │ Date Assignment │ Relationship Assignment     │
│ Agent           │ Agent           │ Agent                       │
│                 │                 │                             │
│ • Reads chunks  │ • Reads context │ • Reads context around      │
│ • Identifies    │   around events │   events                    │
│   major events  │ • Finds         │ • Identifies temporal       │
│ • Maps to CSV   │   absolute      │   relationships             │
│   entries       │   dates         │ • Creates graph edges       │
└─────────────────┴─────────────────┴─────────────────────────────┘
                                │
                                ▼
                    ┌─────────────────────────────┐
                    │     Frontend Interface      │
                    │                             │
                    │ • View all AI agent chats   │
                    │ • See prompts & responses   │
                    │ • Query graph database      │
                    │ • Visualize timeline        │
                    │   conflicts                 │
                    └─────────────────────────────┘
```

## Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Graph Database**: Neo4j with `neo4j-driver`
- **Document Processing**: `node-word-extractor` or `officeParser`
- **CSV Processing**: `csv-parser`
- **LLM Integration**: `openai` package + `@anthropic-ai/sdk`

### Frontend  
- **Framework**: React 18+
- **Build Tool**: Vite
- **Real-time Communication**: Socket.IO
- **HTTP Client**: Axios
- **Styling**: CSS Modules or Tailwind CSS

### AI Integration
- **Primary LLM**: OpenAI GPT-4 or Claude Sonnet
- **Context Window**: Large context models preferred (GPT-4 Turbo/Claude)
- **Function Calling**: For structured data extraction

## Sequential Development Phases

### Phase 1: Core Infrastructure & Database Setup
- Set up Neo4j database with proper schemas
- Create basic Express server structure
- Implement configuration management
- Set up logging and error handling

### Phase 2: Document Processing System
- Implement DOCX text extraction with chunking
- Create spreadsheet parsing functionality  
- Build file management utilities
- Add data validation and preprocessing

### Phase 3: Event Detection AI Agent
- Design event detection prompts and logic
- Implement chunk-by-chunk processing
- Create graph database event insertion
- Add reference tracking (novel, chunk, character range)

### Phase 4: Date Assignment AI Agent  
- Build context window reader around events
- Implement absolute date extraction logic
- Update graph database with temporal data
- Handle various date formats and expressions

### Phase 5: Relationship Assignment AI Agent
- Create relationship detection prompts
- Implement temporal relationship extraction
- Build graph edge creation functionality
- Handle dynamic event node creation

### Phase 6: Frontend Chat Interface
- Build React-based chat interface
- Implement real-time agent communication display
- Create graph query and visualization tools
- Add timeline conflict detection views

## Data Models

### Graph Database Schema
```cypher
// Event Node
CREATE (e:Event {
  id: string,
  name: string,
  description: string, 
  novel_number: integer,
  chunk_number: integer,
  character_start: integer,
  character_end: integer,
  quoted_text: string,
  absolute_date: date (optional),
  date_confidence: float (optional)
})

// Temporal Relationships
CREATE (e1:Event)-[:BEFORE]->(e2:Event)
CREATE (e1:Event)-[:AFTER]->(e2:Event)  
CREATE (e1:Event)-[:SIMULTANEOUS]->(e2:Event)
CREATE (e1:Event)-[:LONG_BEFORE]->(e2:Event)
CREATE (e1:Event)-[:SHORTLY_AFTER]->(e2:Event)
```

### Agent Communication Schema
```javascript
{
  id: uuid,
  timestamp: ISO8601,
  agent_type: "event_detection" | "date_assignment" | "relationship_assignment",
  direction: "prompt" | "response", 
  content: string,
  context: {
    novel_number: integer,
    chunk_number: integer,
    event_id: string (optional)
  }
}
```

## Quality Assurance Requirements

### Code Standards
- Use TypeScript for type safety
- Implement comprehensive error handling
- Follow ESLint configuration with Airbnb rules
- 80%+ test coverage with Jest
- Use async/await patterns consistently

### Architecture Principles
- Single Responsibility Principle for all modules
- Dependency injection for testability  
- Interface-based design for AI agents
- Event-driven architecture for real-time updates
- Clean separation between data, business logic, and presentation

### Performance Requirements
- Handle novels up to 500,000 words
- Process chunks in parallel where possible
- Implement rate limiting for LLM API calls
- Cache processed results to avoid reprocessing
- Support concurrent processing of multiple novels

## Integration Points

### Between Phases
- **Phase 1→2**: Database connection and basic file I/O
- **Phase 2→3**: Preprocessed chunks and CSV event mappings  
- **Phase 3→4**: Event nodes created in database
- **Phase 4→5**: Events with temporal context available
- **Phase 5→6**: Complete graph with relationships for visualization

### API Contracts
- Standardized response formats between all AI agents
- RESTful endpoints for frontend data access
- WebSocket events for real-time agent communication
- GraphQL endpoint for complex graph queries (optional)

## Deployment Strategy

### Development
- Docker Compose with Neo4j, Node.js, and React services
- Environment-based configuration
- Hot reload for both frontend and backend
- Shared volumes for development file access

### Production Considerations  
- Neo4j cluster deployment for high availability
- Load balancing for multiple agent instances
- Rate limiting and API key rotation
- Monitoring and alerting for agent performance
- Backup strategy for graph database

## Success Criteria

### Functional Requirements
- ✅ Successfully process all 5 novels without errors
- ✅ Identify and store 90%+ of major events from reference CSV
- ✅ Extract temporal relationships with 80%+ accuracy
- ✅ Detect timeline conflicts and inconsistencies
- ✅ Provide real-time visibility into agent processing

### Technical Requirements
- ✅ Sub-5 second response time for graph queries
- ✅ Support for rerunning processing on updated novels
- ✅ Scalable to additional novels in the series
- ✅ Comprehensive logging for debugging and analysis
- ✅ Intuitive frontend interface for non-technical users

## Risk Mitigation

### LLM API Limitations
- Implement retry logic with exponential backoff
- Use multiple LLM providers as fallbacks
- Cache successful extractions to reduce API calls
- Monitor token usage and implement cost controls

### Data Quality Issues
- Validate all extractions against expected formats
- Implement confidence scoring for AI decisions
- Allow manual review and correction workflows
- Create data quality metrics and reporting

### Performance Bottlenecks
- Implement async processing for all I/O operations
- Use connection pooling for database operations
- Add profiling and performance monitoring
- Design for horizontal scaling from the start