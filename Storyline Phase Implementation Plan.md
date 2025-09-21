# **Phased Implementation Plan**

Follow these phases in strict order. Each phase builds upon the previous one.

## **Phase 1: Core Setup & Data Ingestion**

**Objective:** Create the foundational Next.js project structure and the logic for reading and preparing the input data.

**Instructions:**

1. **Project Setup:**
   * Initialize a new Next.js project with TypeScript (npx create-next-app@latest storyline --typescript --tailwind --eslint --app).
   * Install additional dependencies: dotenv, mammoth, xlsx, neo4j-driver, pino, @mastra-ai/core.
   * Create a directory structure: /lib, /lib/services, /lib/utils, /data (for input files).
2. **Configuration Service (lib/services/config.ts):**
   * Create a module that loads environment variables from a .env.local file (e.g., NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, LLM_API_KEY).
3. **Database Service (lib/services/database.ts):**
   * Create a module to handle the connection to the Neo4j database using the neo4j-driver.
   * It should export a function getDriver() that returns the driver instance.
   * Include a function to test the connection.
4. **File Parsing Service (lib/services/fileParser.ts):**
   * Implement a function readDocx(filePath) that uses mammoth to extract the raw text content from a .docx file.
   * Implement a function readSpreadsheet(filePath) that uses xlsx to read the event spreadsheet and return the data as an array of JSON objects.
5. **Text Chunking Utility (lib/utils/textChunker.ts):**
   * Create a function chunkText(text, chunkSize, overlapSize) that takes a string of text and splits it into an array of smaller strings (chunks).
   * The chunkSize and overlapSize should be arguments (e.g., 2000 characters and 200 characters).
   * Ensure chunks overlap by overlapSize to maintain context between them.
6. **Create a Test Script:**
   * Create a file _test_phase1.js at the root.
   * This script should import and use the modules created above to:
     * Load a sample .docx file from the /data directory.
     * Chunk the text.
     * Log the first 5 chunks to the console to verify correctness.

## **Phase 2: Mastra.ai Integration & Agent Workflow**

**Objective:** Implement Mastra.ai agents with tool use capabilities that process the text and populate the Neo4j database with real-time streaming.

**Instructions:**

1. **Mastra.ai Setup (lib/services/mastraService.ts):**
   * Initialize Mastra with your chosen LLM provider (OpenAI, Anthropic, etc.).
   * Configure the Mastra engine with streaming capabilities enabled.
   * Create a base agent class that extends Mastra's agent functionality.
2. **Database Tools & Support Services:**
   * **Database Tools (lib/tools/databaseTools.ts):**
     * createEventNode: Tool to create Event nodes with proper typing.
     * createRelationship: Tool to create BEFORE, AFTER, or CONCURRENT relationships.
     * findExistingEvent: Tool to search for existing events by quote or metadata.
     * updateEventNode: Tool to update properties of an existing event, selecting the event by id.
   * **Event Spreadsheet Store Service (lib/services/vectorStore.ts):**
     * Initialize vector database (e.g., Pinecone, Weaviate, or local embeddings).
     * Load TSV spreadsheet content into vectorized format for similarity search.
     * Provide queryEventSpreadsheet function for RAG-based event matching.
   * **Novel Reader Service (lib/services/novelReader.ts):**
     * Loads the content of a docx or txt file
     * Tracks the current reading position in the file based on characters from the beginning.
     * Implement getTextChunk(startChar, endChar) function that returns specific text sections.
     * Implement getNextTextChunk(size) function that returns next N characters from current position.
     * Maintain internal position tracking for sequential processing.
3. **Main Orchestrator (lib/services/orchestrator.ts):**
   * Create a comprehensive orchestrator that manages the complete agent workflow using Mastra.
   * **Core Responsibilities:**
     * **Text Management:** Load novel content and manage text chunk provision to agents
     * **Agent Coordination:** Instantiate and coordinate between event detection and relationship assignment agents
     * **Position Tracking:** Maintain current processing position in the novel text
     * **Response Handling:** Parse agent responses and trigger appropriate next actions
     * **Configuration Management:** Handle configurable variables (EVENT_DISTANCE, MAX_EVENT_COUNT, chunk sizes)
   * **Event Detection Flow Management:**
     * Provide text chunks to the event detection agent
     * Monitor agent responses for "no event found" vs createEventNode calls
     * Automatically advance text position based on agent responses
     * Continue until entire novel is processed
   * **Relationship Assignment Flow Management:**
     * Retrieve all detected events from database in charStart order
     * For each event, identify nearby events within EVENT_DISTANCE characters
     * Limit event groups to MAX_EVENT_COUNT maximum
     * Extract corresponding novel text chunks for context
     * Provide structured prompts to relationship assignment agent
   * **Streaming Integration:** Implement real-time streaming of all agent interactions to connected clients
   * **Error Handling:** Manage agent failures, retries, and workflow recovery
   * **Reusability Design:**
     * Abstract agent interfaces for easy agent swapping/testing
     * Configurable parameters for different processing strategies
     * Modular workflow steps that can be run independently or in sequence
     * Event-driven architecture for extensibility with additional agents
4. **Agent: Event Detection (lib/agents/eventDetector.ts):**
   * Create a Mastra agent that matches novel events to the master event spreadsheet.
   * Initialize with the complete TSV spreadsheet content in the system prompt as context for event types.
   * Provide the agent with the **createEventNode(quote, charStart, charEnd, description)** tool that creates an Event node in Neo4j with the detected event details.
   * **Technical Orchestrator-Agent Interaction Flow:**
     1. **Orchestrator provides text chunk:** The orchestrator provides a piece of text from the novel as a prompt to the agent
     2. **Agent analyzes for events:** The agent reviews this text chunk for events that match the master spreadsheet criteria
     3. **Event found path:** 
        - If the agent finds an event, it calls **createEventNode** with the event details
        - When **createEventNode** is called, the orchestrator is automatically informed of the new event creation
        - The orchestrator then provides the next chunk of text starting from the last character of the newly created event node (char end position)
        - The agent continues analyzing from this new position
     4. **No event found path:**
        - If the agent does not find any events in the provided text, it returns exactly the text **"no event found"**
        - When the orchestrator sees this exact output, it automatically prompts the agent with the next section of text from the novel
     5. **Continuous processing:** This cycle continues until the entire novel has been processed
   * **Agent Response Protocol:**
     - MUST return exact text **"no event found"** when no events are detected (triggers automatic continuation)
     - MUST call **createEventNode** when events are found (triggers position-based continuation)
     - NO other response formats are acceptable for maintaining the automated workflow
   * Enable streaming of all agent reasoning, tool calls, and decision-making process.
5. **Agent: Relationship Assignment (lib/agents/relationshipAssigner.ts):**
   * Create a Mastra agent that analyzes temporal relationships between events.
   * **Technical Orchestrator-Agent Interaction Flow:**
     1. **Post-detection processing:** After the event detection agent has completed processing the entire novel, this agent begins relationship analysis
     2. **Event retrieval and ordering:** The orchestrator retrieves all detected events from the database, sorted by charStart position (chronological order in the text)
     3. **Proximity-based event grouping:** For each primary event, the orchestrator:
        - Identifies all events within **EVENT_DISTANCE** characters (configurable variable) from the primary event's position
        - Limits the group to a maximum of **MAX_EVENT_COUNT** events (configurable variable) to prevent overwhelming the agent
        - Extracts the corresponding novel text chunk starting at the first event's charStart and ending at the last event's charEnd
     4. **Agent analysis prompt:** The orchestrator provides the agent with:
        - The primary event details
        - All nearby events within the distance/count constraints
        - The corresponding novel text chunk containing all these events
     5. **Relationship identification:** The agent analyzes the provided context to identify:
        - Explicit temporal relationships (clearly stated sequence, timing, causation)
        - Implied temporal relationships (logical sequence, narrative flow, contextual clues)
        - Relationship types: BEFORE, AFTER, CONCURRENT between the primary event and nearby events
     6. **Database updates:** The agent uses the **createRelationship** tool to add identified temporal relationships to the Neo4j database
     7. **Systematic processing:** This process repeats for each event in the novel, ensuring comprehensive relationship mapping
   * **Agent Tools:**
     - **createRelationship(fromEventId, toEventId, relationshipType)**: Creates BEFORE, AFTER, or CONCURRENT relationships between events
   * Enable streaming of relationship analysis thinking and tool usage.

## **Phase 3: Real-time Streaming & API Routes**

**Objective:** Create Next.js API routes with Server-Sent Events for real-time agent log streaming.

**Instructions:**

1. **Agent Logging Service (lib/services/agentLogger.ts):**
   * Create a service that uses pino to write structured JSON logs.
   * Configure pino to write to a file: agent_logs.jsonl.
   * Create functions for logging all interaction types: logPrompt, logResponse, logToolCall, logToolResult, logThinking.
   * Integrate with Mastra's streaming events to capture all agent interactions.
2. **Streaming Service (lib/services/streamingService.ts):**
   * Create a service to manage Server-Sent Events connections.
   * Implement functions to broadcast agent logs to all connected clients in real-time.
   * Handle client connection management and cleanup.
3. **API Routes:**
   * **GET /api/logs:** Endpoint that returns historical agent logs from agent_logs.jsonl.
   * **GET /api/stream:** Server-Sent Events endpoint for real-time agent log streaming.
   * **POST /api/process:** Endpoint that triggers the orchestrator workflow with file upload support.
   * **GET /api/events:** Endpoint to query Neo4j for event data and relationships.
4. **File Upload Support (app/api/upload/route.ts):**
   * Create an API route to handle .docx and .txt file uploads.
   * Store uploaded files in the /data directory.
   * Return file metadata for processing.

## **Phase 4: Frontend Interface with Real-time Updates**

**Objective:** Build a Next.js frontend that displays real-time agent interactions and allows file processing initiation.

**Instructions:**

1. **Real-time Hook (components/hooks/useAgentStream.ts):**
   * Create a custom React hook that connects to the Server-Sent Events endpoint.
   * Manage real-time agent log updates and connection state.
   * Handle reconnection logic for dropped connections.
2. **File Upload Component (components/FileUpload.tsx):**
   * Create a drag-and-drop file upload component using Tailwind CSS.
   * Support .docx and .txt file uploads.
   * Display upload progress and trigger processing after upload.
3. **Agent Log Viewer (components/AgentLogViewer.tsx):**
   * Create a component that displays agent interactions in real-time.
   * Render different interaction types (prompt, response, tool_call, tool_result, thinking) with distinct styling.
   * Use auto-scrolling to follow the latest interactions.
   * Apply syntax highlighting for tool parameters and structured data.
4. **Graph Visualization (components/GraphViewer.tsx):**
   * Create a basic component to visualize the Neo4j event graph.
   * Show Event nodes and BEFORE/AFTER/CONCURRENT relationships.
   * Allow basic interaction with the graph (zoom, pan, node selection).
5. **Main Application (app/page.tsx):**
   * Combine all components into a cohesive interface.
   * Implement tabbed or split-pane layout for file upload, agent logs, and graph visualization.
   * Use React state management for coordinating between components.
6. **Styling and UX:**
   * Apply consistent Tailwind CSS styling throughout the application.
   * Implement responsive design for desktop and tablet viewing.
   * Add loading states, error handling, and user feedback mechanisms.

## **Phase 5: Advanced Features & Production Readiness**

**Objective:** Add advanced Mastra.ai features and prepare for production deployment.

**Instructions:**

1. **Agent Memory & Context (lib/services/agentMemory.ts):**
   * Implement Mastra's memory features for agents to maintain context across processing sessions.
   * Store and retrieve relevant event context for relationship analysis.
2. **Multi-Agent Workflows:**
   * Expand the orchestrator to run multiple agents in parallel using Mastra's workflow capabilities.
   * Implement agent handoffs and collaborative processing.
3. **Error Handling & Recovery:**
   * Implement comprehensive error handling with Mastra's built-in retry mechanisms.
   * Add circuit breakers for external API calls.
   * Create error recovery workflows for failed processing attempts.
4. **Performance Optimization:**
   * Implement Mastra's batching features for efficient LLM API usage.
   * Add caching layers for repeated operations.
   * Optimize Neo4j queries and implement connection pooling.
5. **Testing & Monitoring:**
   * Create unit tests for all services and agents.
   * Implement integration tests for the complete workflow.
   * Add Mastra's built-in observability features for production monitoring.
6. **Deployment Configuration:**
   * Configure environment variables for production deployment.
   * Set up Docker containerization if needed.
   * Prepare database migration scripts and seeding data.