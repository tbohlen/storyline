# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Storyline is an AI-powered timeline analysis tool for novels. It helps novelists track complex timelines by analyzing text to identify significant events, establish temporal relationships, and detect potential inconsistencies in the narrative.

The system uses Claude (Anthropic AI) agents to analyze novel text in chunks, creating a Neo4j graph database of events and their temporal relationships. Users can then visualize the timeline and interact with the AI to refine the analysis.

## Prerequisites & Setup

### Required Dependencies
- **Neo4j**: Graph database must be running locally or accessible via connection string
- **Node.js**: For Next.js application
- **Environment Variables**: Copy `.env.example` to `.env` and configure:
  - `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`: Database connection
  - `ANTHROPIC_API_KEY`: Claude API access
  - `USE_MASTER_EVENTS` (optional): Enable master event spreadsheet matching
  - `MASTER_EVENTS_PATH` (optional): Path to CSV with predefined event types

### Common Commands

```bash
# Start Neo4j database
npm run neo4j:start

# Development server
npm run dev                    # Standard dev mode
npm run dev:logs              # Dev mode with debug logging
npm run dev:full              # Start Neo4j + dev server
npm run dev:full:logs         # Start Neo4j + dev with debug logging

# Neo4j management
npm run neo4j:stop            # Stop database
npm run neo4j:status          # Check database status
npm run neo4j:console         # Open Neo4j console

# Build and production
npm run build                 # Build for production
npm run start                 # Start production server
npm run lint                  # Run ESLint
```

## Architecture Overview

### High-Level Processing Flow

1. **Upload**: User uploads a novel (.docx or .txt) via the web interface
2. **Initialization**: Orchestrator loads the novel and initializes the Neo4j database
3. **Event Detection Pass**: Novel is split into overlapping chunks, EventDetectorAgent analyzes each chunk to identify significant events and create Event nodes in the graph
4. **Timeline Resolution Pass**: TimelineResolverAgent analyzes batches of nearby events with surrounding context to establish comprehensive temporal relationships
5. **Visualization**: Users view the event graph and can chat with AI to refine the analysis

### Core Components

#### Orchestrator (`src/lib/services/orchestrator.ts`)
- **Purpose**: Coordinates the entire analysis workflow
- **Responsibilities**:
  - Manages NovelReader for text chunking
  - Orchestrates two-pass analysis: event detection, then timeline resolution
  - Emits progress updates via Server-Sent Events (SSE)
  - Handles error recovery and statistics tracking
- **Key Configuration**:
  - `chunkSize`: Text chunk size for analysis (default: 2000 chars)
  - `overlapSize`: Overlap between chunks to avoid cutting events (default: 400 chars)
  - `batchRadius`: Groups events within this range for timeline resolution (default: 2500 chars)
  - `contextMargin`: Extra context around batches for timeline resolution (default: 1000 chars)

#### AI Agents

**EventDetectorAgent** (`src/lib/agents/eventDetector.ts`)
- **Purpose**: First-pass agent that identifies significant events in text chunks
- **Model**: `claude-sonnet-4-5-20250929`
- **Tools Available**:
  - `create_event`: Creates Event nodes with quote, description, character positions
  - `create_relationship`: Establishes temporal relationships (BEFORE, AFTER, CONCURRENT, IDENTICAL)
  - `find_event`: Checks for existing events to avoid duplicates
  - `update_event`: Updates event properties
  - `get_recent_events`: Retrieves recent events for cross-chunk relationship detection
- **Output**: Returns event IDs or "no event found"

**TimelineResolverAgent** (`src/lib/agents/timelineResolver.ts`)
- **Purpose**: Second-pass agent that analyzes batches of nearby events to establish comprehensive temporal relationships
- **Model**: `claude-sonnet-4-5-20250929`
- **Key Behavior**: Documents ALL implied temporal orderings, even if contradictory (contradictions reveal inconsistencies in source material)
- **Tools Available**:
  - `create_relationship`: Links events with supporting text
  - `update_event`: Adds inferred dates or master event links
  - `find_master_event`: Matches events to predefined master event types

#### Database Layer

**Neo4j Graph Structure** (`src/lib/db/events.ts`, `src/lib/services/database.ts`)
- **Event Nodes** (`:Event` label):
  - `id`: UUID (unique constraint)
  - `novelName`: Source novel filename (indexed)
  - `quote`: Exact text from novel
  - `description`: Short, human-readable summary
  - `charRangeStart`, `charRangeEnd`: Position in source text (indexed on start)
  - `spreadsheetId`: Optional link to master event types (indexed)
  - `approximateDate`, `absoluteDate`: Temporal information
  - `createdAt`: Timestamp
- **Relationships**: `BEFORE`, `AFTER`, `CONCURRENT`, `IDENTICAL`
  - Property: `sourceText` (supporting quote from novel)

**Key Database Functions**:
- `createEventNode()`: Creates Event node with UUID
- `createRelationship()`: Links two events with relationship type
- `getAllEvents()`: Retrieves all events for a novel, ordered by `charRangeStart`
- `getBatchRelationships()`: Gets existing relationships for event batch

#### Communication Layer

**Server-Sent Events (SSE)** (`src/lib/services/sse-emitter.ts`)
- Real-time progress updates from backend to frontend
- Messages use AI SDK `UIMessage` format (roles: 'user', 'assistant', 'system')
- Message types: `status`, `text`, `tool-call`, `tool-result`, `reasoning`
- Keyed by filename to support multiple concurrent analyses

**Message Helpers** (`src/lib/utils/message-helpers.ts`)
- `createStatusMessage()`: System status updates
- `createTextMessage()`: Text messages from agents
- `createToolCallMessage()`, `createToolResultMessage()`: Tool execution tracking
- `createReasoningMessage()`: AI thinking/reasoning display

#### Frontend Structure

**Pages**:
- `/` (`src/app/page.tsx`): Upload interface
- `/observer` (`src/app/observer/page.tsx`): Real-time analysis monitoring with SSE

**API Routes**:
- `/api/upload`: Handles file upload
- `/api/process`: Starts orchestrator analysis
- `/api/stream`: SSE endpoint for progress updates
- `/api/graph`: Returns graph data for visualization
- `/api/chat`: Chat interface for post-analysis refinement

**State Management**:
- Zustand stores: `graph-store.ts` for graph visualization state
- React hooks for SSE subscription and UI state

**Components**:
- `graph-visualization.tsx`, `graph-canvas.tsx`: Neo4j graph rendering using `@neo4j-nvl/react`
- `orchestrator-observer.tsx`: SSE stream display
- `chat-interface.tsx`: Chat UI with AI SDK hooks

## Important Implementation Notes

### Text Chunking Strategy
- Chunks overlap to prevent events from being split across boundaries
- `NovelReader.getCleanTextChunk()` finds word boundaries to create clean chunks
- After processing, position advances by `chunkSize - overlapSize`

### Event Detection Guidelines
- Agents should identify ~1 event per 1000 characters (configurable)
- Focus on significant story events: actions, discoveries, arrivals, confrontations
- Include backstory and flashback events, not just present-tense narrative
- Character positions (`charRangeStart`, `charRangeEnd`) are relative to chunk start (0-indexed)
- Global positions are calculated by adding `globalStartPosition` offset

### Temporal Relationship Strategy
- Timeline resolution analyzes events in batches (events within `batchRadius`)
- Each batch receives surrounding context (`contextMargin` on each side)
- Agents document ALL implied orderings, even contradictory ones
- Contradictions are valuable data, not errors—they reveal source inconsistencies

### Master Events (Optional Feature)
- When enabled, system loads CSV of predefined event types
- EventDetector can link detected events to master event IDs via `spreadsheetId`
- TimelineResolver can use `find_master_event` tool to match events post-detection

### Logging
- Structured logging via Pino (`src/lib/utils/logger.ts`)
- Different loggers for different subsystems: `orchestrator`, `eventDetector`, `timeline`, `database`
- Log levels controlled by `LOG_LEVEL` environment variable
- Use `npm run dev:logs` for debug output

## Type System & AI SDK Integration

The codebase uses:
- **AI SDK** (`ai` package): `streamText`, `ToolLoopAgent`, tool definitions
- **Anthropic AI SDK** (`@ai-sdk/anthropic`): Claude model access
- **Zod**: Schema validation for tool inputs/outputs (see `src/lib/tools/event-tools.ts`)
- **UIMessage format**: Standard message format from AI SDK for SSE communication

## File Upload & Processing
- Supported formats: `.docx` (via mammoth.js), `.txt`
- Files uploaded to `/data` directory
- Optional master events CSV in `/data` as well
- CSV parsing via `csv-parse` library

## Development Patterns

### Adding New Tool Functions
1. Define Zod schemas for input/output in `event-tools.ts`
2. Create tool using AI SDK `tool()` function
3. Implement backing database function in `events.ts`
4. Add tool to agent's tool configuration
5. Update agent system prompt to describe tool usage

### Debugging Analysis Issues
1. Check Neo4j database directly using `neo4j:console`
2. Enable debug logging with `npm run dev:logs`
3. Monitor SSE stream in `/observer` page for agent reasoning
4. Query events: `MATCH (e:Event {novelName: "filename.txt"}) RETURN e`
5. Query relationships: `MATCH (e1:Event)-[r]->(e2:Event) RETURN e1.description, type(r), e2.description`

### Adding New Agent Types
Follow the pattern in existing agents:
- Constructor takes `novelName` and `emitMessage` callback
- `initialize()` method for setup
- Build system prompt with clear instructions and tool descriptions
- Use `ToolLoopAgent` with `onStepFinish` callback for progress tracking
- Emit messages using helper functions from `message-helpers.ts`

## Common Gotchas

- Neo4j must be running before starting the app—use `npm run dev:full` to start both
- SSE connections are keyed by filename—multiple analyses can run simultaneously
- Character positions are 0-indexed and relative to chunk/novel start depending on context
- Environment variable changes require server restart
- Agent reasoning is streamed in real-time via SSE—check `/observer` page for debugging
