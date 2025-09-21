# **Project Brief: Novel Timeline Analysis Engine**

## **1\. Project Overview**

The goal of this project is to build a Node.js application that runs an AI agent workflow. This workflow will process novels from a series, identify significant events, and map their temporal relationships in a graph database. The primary objective is to analyze the timeline of events across multiple books and detect potential inconsistencies. A simple web frontend will be created to display the real-time thought process of the AI agents by showing their prompts and responses.

## **2\. System Architecture**

The system is a monolithic Node.js application built with next.js. The system will support a web-based frontend for observation. It follows a modular, service-oriented pattern.

* **Backend:** A Node.js server built with Next.js. It will handle data ingestion, orchestrate the AI agent workflow, interact with the graph database, and serve an API for the frontend.  
* **Data Storage:** A Neo4j graph database will store event nodes and their relationships.  
* **AI Integration:** The system will use Mastra.ai, a TypeScript AI agent framework, for managing AI agents, tool use, and real-time streaming of agent interactions to the frontend. The LLM provider will be configurable through Mastra's provider system.  
* **Frontend:** A simple, single-page React application will consume data from the backend API to display agent logs. It will also allow the user to start a new run of the software using a new docx or txt file. That file will ten be analyzed, with the process output in human-readable format on the frontend.

## **3\. Technology Stack**

* **Backend:** Node.js, Next.js
* **AI Framework:** Mastra.ai for agent management, tool use, and real-time streaming
* **Database:** Neo4j (using the neo4j-driver for Node.js)
* **File Parsing:**
  * .docx: mammoth library
  * .xlsx: xlsx library
* **Logging:** pino for structured, file-based logging of agent interactions.
* **Frontend:** React (via Next.js)), Tailwind CSS for styling.
* **API Communication:** REST API between backend and frontend, with real-time streaming via Mastra.ai.

## **4\. Data Models**

### **4.1. Neo4j Graph Schema**

The graph will consist of Event nodes and BEFORE, AFTER, and CONCURRENT relationships which indicate how one event relates to another temporally.

**Node: Event**

* id: Unique identifier (e.g., UUID).  
* spreadsheetId: The corresponding ID from the input events spreadsheet.  
* novelName: The name of the provided docx or txt file that this event was found in.
* quote: The direct text quote describing the event.  
* description: A natural language description of the event, as the AI understands it from the text it has just read. This may provide more context than the direct quote.
* charRangeStart: The starting character index of the quote in the novel text.  
* charRangeEnd: The ending character index of the quote.  
* absoluteDate: (Optional) A string representing any hard date found (e.g., "1888-04-12").

**Relationships: BEFORE, AFTER, CONCURRENT**

* **BEFORE**: Indicates that the source event occurred before the target event.
* **AFTER**: Indicates that the source event occurred after the target event.
* **CONCURRENT**: Indicates that the source event occurred at the same time as the target event.

Each relationship contains:
* sourceText: The snippet of text that implies this temporal relationship.

### **4.2. Agent Log Schema (for agent\_logs.jsonl)**

Each line in the log file will be a JSON object representing a single interaction.

{
  "timestamp": "2023-10-27T10:00:00Z",
  "agentName": "EventDetectionAgent",
  "interactionType": "prompt" | "response" | "tool_call" | "tool_result" | "thinking",
  "content": "The text of the prompt, AI response, tool call details, tool result, or thinking step.",
  "toolName": "Optional. Present for tool_call and tool_result interactions.",
  "toolParameters": "Optional. Present for tool_call interactions. The parameters passed to the tool.",
  "metadata": {
    "novelNumber": 1,
    "chunkNumber": 42
  }
}

## **5\. General Coding Standards**

* **Modularity:** Each core piece of functionality (file parsing, database interaction, AI service, agents) must be in its own module/file within a logical directory structure (e.g., /src/services, /src/agents).  
* **Configuration:** All external configuration (database credentials, LLM API keys, file paths) must be managed through environment variables (.env file). Do not hardcode them.  
* **Asynchronous Operations:** Use async/await for all asynchronous operations, including file I/O, database queries, and API calls.  
* **Error Handling:** Implement robust try/catch blocks for all I/O and API operations. Log errors clearly.  
* **Comments:** Add JSDoc-style comments to all functions and modules explaining their purpose, parameters, and return values. Include inline comments for complex logic.  
* **Logging:** In addition to the agent interaction logs, use a standard logger (like pino) for application-level logging (e.g., "Starting server", "Database connected", "Error processing file X").