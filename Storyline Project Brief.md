# **Project Brief: Novel Timeline Analysis Engine**

## **1\. Project Overview**

The goal of this project is to build a Node.js application that runs an AI agent workflow. This workflow will process novels from a series, identify significant events, and map their temporal relationships in a graph database. The primary objective is to analyze the timeline of events across multiple books and detect potential inconsistencies. A simple web frontend will be created to display the real-time thought process of the AI agents by showing their prompts and responses.

## **2\. System Architecture**

The system is a monolithic Node.js application with a web-based frontend for observation. It follows a modular, service-oriented pattern.

* **Backend:** A Node.js server built with Express.js. It will handle data ingestion, orchestrate the AI agent workflow, interact with the graph database, and serve an API for the frontend.  
* **Data Storage:** A Neo4j graph database will store event nodes and their relationships.  
* **AI Integration:** The system will interact with a Large Language Model (LLM) via a generic API. The specific LLM provider will be configurable.  
* **Frontend:** A simple, single-page React application will consume data from the backend API to display agent logs.

## **3\. Technology Stack**

* **Backend:** Node.js, Express.js  
* **Database:** Neo4j (using the neo4j-driver for Node.js)  
* **File Parsing:**  
  * .docx: mammoth library  
  * .xlsx: xlsx library  
* **Logging:** pino for structured, file-based logging of agent interactions.  
* **Frontend:** React (bootstrapped with Vite), Tailwind CSS for styling.  
* **API Communication:** REST API between backend and frontend.

## **4\. Data Models**

### **4.1. Neo4j Graph Schema**

The graph will consist of Event nodes and RELATES\_TO relationships.

**Node: Event**

* id: Unique identifier (e.g., UUID).  
* spreadsheetId: The corresponding ID from the input events spreadsheet.  
* novelNumber: The number of the novel this event is from.  
* quote: The direct text quote describing the event.  
* charRangeStart: The starting character index of the quote in the novel text.  
* charRangeEnd: The ending character index of the quote.  
* absoluteDate: (Optional) A string representing any hard date found (e.g., "1888-04-12").

**Relationship: RELATES\_TO**

* type: The nature of the temporal relationship (e.g., 'BEFORE', 'AFTER', 'DURING').  
* sourceText: The snippet of text that implies this relationship.

### **4.2. Agent Log Schema (for agent\_logs.jsonl)**

Each line in the log file will be a JSON object representing a single interaction.

{  
  "timestamp": "2023-10-27T10:00:00Z",  
  "agentName": "EventDetectionAgent",  
  "interactionType": "prompt" | "response",  
  "content": "The text of the prompt or the full AI response.",  
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