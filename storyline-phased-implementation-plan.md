# **Phased Implementation Plan**

Follow these phases in strict order. Each phase builds upon the previous one.

## **Phase 1: Core Setup & Data Ingestion** ✅ COMPLETED

**Objective:** Create the foundational Next.js project structure and the logic for reading and preparing the input data.

**Instructions:**

1. **Project Setup:** ✅
   * Initialize a new Next.js project with TypeScript (npx create-next-app@latest storyline --typescript --tailwind --eslint --app).
   * Install additional dependencies: dotenv, mammoth, xlsx, neo4j-driver, pino, @mastra-ai/core.
   * Create a directory structure: /lib, /lib/services, /lib/utils, /data (for input files).
2. **Configuration Service (lib/services/config.ts):** ✅
   * Create a module that loads environment variables from a .env.local file (e.g., NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, LLM_API_KEY).
3. **Database Service (lib/services/database.ts):** ✅
   * Create a module to handle the connection to the Neo4j database using the neo4j-driver.
   * It should export a function getDriver() that returns the driver instance.
   * Include a function to test the connection.
4. **Create a README:** ✅
   * Create a readme explaining the project
   * include instructions for running the project, including how to run neo4j.
4. **File Parsing Service (lib/services/fileParser.ts):** ✅
   * Implement a function readDocx(filePath) that uses mammoth to extract the raw text content from a .docx file.
   * Implement a function readSpreadsheet(filePath) that uses xlsx to read the event spreadsheet and return the data as an array of JSON objects.
5. **Create a Test Script:** ✅
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

## **Phase 3: Chat-Based Frontend Interface**

**Objective:** Build a Next.js frontend with a chat interface that displays real-time agent interactions using Mastra's streaming capabilities.

**Instructions:**

1. **File Upload Interface (components/FileUpload.tsx):**
   * Create a drag-and-drop file upload component using Tailwind CSS.
   * Support .docx and .txt file uploads with visual feedback.
   * Display "Start Processing" button after successful file upload.
   * Handle upload state and error messaging.

2. **Chat Interface (components/ChatInterface.tsx):**
   * Build a chat window that appears when "Start Processing" button is clicked.
   * Implement chat bubbles for each agent message with distinct styling.
   * Auto-scroll to follow latest messages during processing.
   * Show processing status and completion indicators.

3. **Agent Message Components:**
   * **Agent Identifier (components/AgentBubble.tsx):**
     * Display clear agent names: "Orchestrator", "Event Detector", "Relationship Detector".
     * Use distinct colors/icons for each agent type.
   * **Tool Call Display (components/ToolCallBubble.tsx):**
     * Render tool calls in visually distinct format (e.g., code blocks, highlighted boxes).
     * Show tool name, parameters, and results clearly.
     * Use syntax highlighting for JSON parameters.
   * **Thinking Block Display (components/ThinkingBubble.tsx):**
     * Display agent reasoning/thinking in expandable/collapsible format.
     * Use different styling to distinguish from regular messages.

4. **Main Application Layout (app/page.tsx):**
   * Two-phase interface: File upload view → Chat interface view.
   * Simple state management to switch between upload and chat modes.
   * Display processing completion and option to view results.
   * Prepare layout structure for future API integration.

5. **Styling and UX:**
   * Use Tailwind CSS for consistent styling across all components.
   * Implement responsive design optimized for chat interface.
   * Add loading animations and processing indicators.
   * Clear visual hierarchy for different message types and agents.

## **Phase 4: API Integration & Real-time Streaming**

**Objective:** Create Next.js API routes that integrate with the frontend to provide real-time agent interactions and complete the functional application.

**Instructions:**

1. **API Routes:**
   * **POST /api/upload:** Handle .docx and .txt file uploads, store in /data directory, return file metadata.
   * **POST /api/process:** Endpoint that triggers the Mastra workflow and returns a streaming response.
     * Use Mastra's `agent.streamVNext()` with `format: 'aisdk'` for Next.js compatibility.
     * Return `stream.toUIMessageStreamResponse()` for direct frontend consumption.
     * Configure streaming callbacks to capture agent names, tool calls, and thinking blocks.
   * **GET /api/events:** Query Neo4j for event data and relationships (for future graph visualization).

2. **Mastra Streaming Integration (lib/services/streamingAdapter.ts):**
   * Create an adapter that captures Mastra's native streaming events using `onStepFinish`, `onChunk`, `onError`, `onAbort` callbacks.
   * Transform Mastra's streaming data into chat message format with agent names and message types.
   * Handle different event types: agent messages, tool calls, thinking blocks, and errors.
   * Use Mastra's built-in streaming instead of custom logging services.

3. **Chat Message Formatting:**
   * Leverage Mastra's streaming callbacks to automatically format messages by agent:
     * **Orchestrator**: Workflow coordination messages and text chunk assignments.
     * **Event Detector**: Event analysis, "no event found" responses, and `createEventNode` tool calls.
     * **Relationship Detector**: Relationship analysis and `createRelationship` tool calls.
   * Use Mastra's built-in tool call streaming to automatically display tool executions with parameters and results.
   * Capture thinking blocks from agents that support reasoning display.

4. **Frontend Integration Hook (hooks/useMastraStream.ts):**
   * Create React hook that consumes Mastra's streaming response from `/api/process`.
   * Handle different message types: agent messages, tool calls, thinking blocks, errors.
   * Manage connection state and error handling automatically.
   * Parse streaming data to extract agent names and message content.
   * Integrate with existing ChatInterface component from Phase 3.

5. **Complete Integration:**
   * Connect FileUpload component to `/api/upload` endpoint.
   * Connect ChatInterface component to streaming hook and `/api/process` endpoint.
   * Implement proper error handling and loading states throughout the application.
   * Test complete workflow: file upload → processing trigger → real-time chat updates → completion.

## **Phase 5: Neo4j Visualization & Split-Screen Interface**

**Objective:** Add real-time Neo4j graph visualization using neovis.js and implement a split-screen layout with chat on the left and graph visualization on the right.

**Instructions:**

1. **Dependencies & Setup:**
   * Install neovis.js: `npm install neovis.js`
   * Install additional typing if needed: `npm install @types/neovis.js` (if available)
   * Configure Neo4j connection settings for browser access (CORS, authentication)

2. **Graph Visualization Component (components/GraphVisualization.tsx):**
   * Create a React component that integrates neovis.js for Neo4j visualization
   * Configure neovis with Neo4j connection details (URI, credentials)
   * Set up graph styling for Event nodes and relationship types (BEFORE, AFTER, CONCURRENT)
   * Implement node styling: Event nodes with distinct colors, labels showing event descriptions
   * Configure relationship styling: Different colors/styles for BEFORE (green), AFTER (red), CONCURRENT (blue)
   * Add interaction capabilities: node selection, zoom, pan, and reset view
   * Implement graph legends explaining node types and relationship meanings

3. **Real-time Graph Updates:**
   * Integrate graph updates with the chat interface processing
   * Listen for tool call completions (createEventNode, createRelationship) from the stream
   * Trigger graph refresh/updates when new nodes or relationships are created
   * Implement incremental graph updates rather than full reloads for better performance
   * Add visual indicators when graph is updating (loading states)

4. **Split-Screen Layout (components/SplitScreenInterface.tsx):**
   * Modify the main application layout to show both chat and graph simultaneously
   * Initialize both chat and graph components simultaneously
   * Implement responsive split-screen: Chat interface (left 30%), Graph visualization (right 70%)
   * Maintain proper responsive behavior for different screen sizes
   * Ensure both panels remain functional and properly sized

5. **Integration & Polish:**
   * Ensure seamless coordination between chat progress and graph updates
   * Add error handling for Neo4j connection issues
   * Implement fallback UI if graph visualization fails to load