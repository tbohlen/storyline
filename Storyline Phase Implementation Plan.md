# **Phased Implementation Plan**

Follow these phases in strict order. Each phase builds upon the previous one.

## **Phase 1: Core Setup & Data Ingestion**

**Objective:** Create the foundational project structure and the logic for reading and preparing the input data.

**Instructions:**

1. **Project Setup:**  
   * Initialize a new Node.js project (npm init \-y).  
   * Install initial dependencies: express, dotenv, mammoth, xlsx, neo4j-driver, pino.  
   * Create a basic Express server in src/index.js that starts and listens on a port defined in your .env file.  
   * Create a directory structure: /src, /src/services, /src/utils, /data (for input files).  
2. **Configuration Service (src/services/config.js):**  
   * Create a module that loads environment variables from a .env file (e.g., NEO4J\_URI, NEO4J\_USER, NEO4J\_PASSWORD).  
3. **Database Service (src/services/database.js):**  
   * Create a module to handle the connection to the Neo4j database using the neo4j-driver.  
   * It should export a function getDriver() that returns the driver instance.  
   * Include a function to test the connection.  
4. **File Parsing Service (src/services/fileParser.js):**  
   * Implement a function readDocx(filePath) that uses mammoth to extract the raw text content from a .docx file.  
   * Implement a function readSpreadsheet(filePath) that uses xlsx to read the event spreadsheet and return the data as an array of JSON objects.  
5. **Text Chunking Utility (src/utils/textChunker.js):**  
   * Create a function chunkText(text, chunkSize, overlapSize) that takes a string of text and splits it into an array of smaller strings (chunks).  
   * The chunkSize and overlapSize should be arguments (e.g., 2000 characters and 200 characters).  
   * Ensure chunks overlap by overlapSize to maintain context between them.  
6. **Create a Test Script:**  
   * Create a file \_test\_phase1.js at the root.  
   * This script should import and use the modules created above to:  
     * Load a sample .docx file from the /data directory.  
     * Chunk the text.  
     * Log the first 5 chunks to the console to verify correctness.

## **Phase 2: Agentic Workflow & Database Logic**

**Objective:** Implement the core AI agents that process the text and populate the Neo4j database.

**Instructions:**

1. **LLM Service (src/services/llmService.js):**  
   * Create a generic service for interacting with a Large Language Model.  
   * It should have a single function, generate(prompt).  
   * The function should be a placeholder for now. It should log the prompt it receives and return a hardcoded, realistic JSON response based on the agent that will call it.  
   * **DO NOT** implement the actual fetch call to an LLM API yet. This placeholder allows for building the workflow without needing a live API key.  
2. **Agent: Event Detection (src/agents/eventDetector.js):**  
   * Create a function detectEvent(chunkText, novelNumber, chunkNumber).  
   * This function will construct a detailed prompt for the LLM to identify a major event in the chunkText.  
   * It will call llmService.generate(), parse the mock JSON response, and then use the database service to create a new :Event node in Neo4j with the relevant properties.  
   * Ensure all database writes are done within a transaction.  
3. **Agent: Date Assignment (src/agents/dateAssigner.js):**  
   * Create a function assignDate(eventData). eventData will contain the event's quote and its surrounding text.  
   * It will construct a prompt asking the LLM to find any absolute dates in the surrounding text.  
   * It will call llmService.generate() and parse the response.  
   * If a date is found, it will update the corresponding :Event node in Neo4j with the absoluteDate property.  
4. **Agent: Relationship Assignment (src/agents/relationshipAssigner.js):**  
   * Create a function assignRelationships(eventData).  
   * It will construct a prompt asking the LLM to identify temporal relationships (e.g., "before", "after") between the current event and any other events mentioned in the surrounding text.  
   * It will call llmService.generate(), parse the response, and create RELATES\_TO relationships between the :Event nodes in Neo4j. If a mentioned event does not exist, create a new placeholder :Event node for it.  
5. **Main Orchestrator Script (src/main.js):**  
   * Create a main script that orchestrates the entire workflow.  
   * It should perform the steps from Phase 1 (read, chunk).  
   * Then, it should loop through each chunk and call the eventDetector.  
   * For each event found, it should then call the dateAssigner and relationshipAssigner.  
   * Add extensive logging to track progress.

## **Phase 3: Logging Service & Backend API**

**Objective:** Create a structured logging system for agent interactions and expose the data and workflow via a backend API.

**Instructions:**

1. **Agent Logging Service (src/services/agentLogger.js):**  
   * Create a service that uses pino to write structured JSON logs.  
   * Configure pino to write to a file: agent\_logs.jsonl.  
   * Create a single function, logInteraction(logData), where logData is an object matching the schema in the Project Brief.  
   * Integrate this logger into the llmService from Phase 2\. Before calling the LLM and after receiving a response, call logInteraction to record the prompt and the response. Update the placeholder llmService to use this logger.  
2. **API Routes Setup (src/api/routes.js):**  
   * Create an Express router.  
   * **GET /api/logs:** Create an endpoint that reads the agent\_logs.jsonl file, parses the line-by-line JSON, and returns the entire log history as a single JSON array.  
   * **POST /api/process:** Create an endpoint that triggers the main orchestrator script from Phase 2\. It should accept a request body specifying the novel to process (e.g., { "novelNumber": 1 }). This endpoint should run the processing asynchronously and immediately return a 202 Accepted status with a message like "Processing started."  
3. **Update src/index.js:**  
   * Import and use the API router in your main Express application.  
   * Add middleware to handle JSON request bodies and CORS (express.json(), cors library).

## **Phase 4: Frontend Viewer**

**Objective:** Build a simple web interface to view the agent interaction logs.

**Instructions:**

1. **Project Setup:**  
   * Inside your project root, create a new React project using Vite: npm create vite@latest frontend \-- \--template react.  
   * cd frontend and install tailwindcss. Follow the Tailwind CSS installation guide for Vite.  
2. **API Service (frontend/src/apiService.js):**  
   * Create a simple function that fetches data from the http://localhost:PORT/api/logs endpoint.  
3. **Main App Component (frontend/src/App.jsx):**  
   * Use useState to store the array of log entries.  
   * Use useEffect to call the API service on component mount and populate the state.  
   * Set up a polling mechanism (e.g., setInterval) inside the useEffect to refetch the logs every 5 seconds so the display updates as the backend processes a novel.  
4. **UI Component (frontend/src/components/LogViewer.jsx):**  
   * Create a component that takes the log entries as a prop.  
   * Map over the array of entries and render them in a chat-style interface.  
   * Style each message differently based on agentName and interactionType. For example, give prompts and responses different background colors.  
   * Clearly display the agent name, timestamp, and content for each entry.  
   * Use Tailwind CSS for all styling to create a clean, modern, and readable interface.