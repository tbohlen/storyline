# Event Message Types

This document lists all event message types currently handled by the system, as defined in `src/components/event-message.tsx`.

## Event Message Structure

```typescript
interface EventMessageData {
  agent: string;        // Which agent/component sent the message
  type: string;         // Event type (see below)
  message: string;      // Human-readable message
  timestamp: string;    // ISO timestamp
  filename?: string;    // Optional filename being processed
  data?: object;        // Optional structured data
}
```

## Agent Types

The system recognizes these agent types with specific icons and colors:

- **orchestrator** - Purple, Zap icon - Manages the overall process
- **event-detector** - Blue, Bot icon - Detects events in text
- **timeline-resolver** - Amber, FileText icon - Resolves temporal relationships
- **database** - Green, Database icon - Database operations
- **system** - Gray, FileText icon - System messages

## Event Types

### 1. `thinking`
**Purpose**: Shows AI reasoning and internal thoughts
**Visual**: Blue background with spinner
**Data**: `{ content: string }` - The AI's reasoning text
**Component**: `ThinkingEventMessage`

### 2. `error`
**Purpose**: Reports errors
**Visual**: Red border and background
**Icon**: AlertTriangle
**Component**: `ErrorEventMessage`

### 3. `success`
**Purpose**: Reports successful operations
**Visual**: Green border and background
**Icon**: CheckCircle
**Component**: `SuccessEventMessage`

### 4. `completed`
**Purpose**: Reports completion of a process
**Visual**: Green border and background
**Icon**: CheckCircle
**Component**: `SuccessEventMessage` (same as success)

### 5. `analyzing`
**Purpose**: Indicates analysis in progress
**Visual**: Blue border with spinner
**Icon**: Spinning Loader2
**Component**: `ProcessingEventMessage`

### 6. `processing`
**Purpose**: Indicates general processing state
**Visual**: Blue border with spinner
**Icon**: Spinning Loader2
**Component**: `ProcessingEventMessage` (same as analyzing)

### 7. `status`
**Purpose**: General status updates
**Visual**: Standard styling
**Icon**: Info icon
**Component**: `StatusEventMessage`

### 8. `info`
**Purpose**: Informational messages
**Visual**: Standard styling
**Icon**: Info icon
**Component**: `StatusEventMessage` (same as status)

### 9. `progress`
**Purpose**: Progress updates with percentage
**Visual**: Standard styling with progress bar if data includes `progress` field
**Data**: `{ progress: number, ...other }` - Progress percentage (0-100)
**Component**: `ProgressEventMessage`

### 10. `result`
**Purpose**: Shows results from operations
**Visual**: Standard styling
**Component**: `ResultEventMessage`

### 11. `tool_call`
**Purpose**: Shows when AI calls a tool
**Visual**: Purple border and background
**Data**: Tool call details
**Component**: `ToolCallEventMessage`

### 12. `tool_result`
**Purpose**: Shows results from tool executions
**Visual**: Standard styling
**Component**: `ToolResultEventMessage`

### 13. `step`
**Purpose**: Agent step completion notifications
**Visual**: Standard styling
**Data**: Step details (finish reason, usage stats, etc.)
**Component**: `StepEventMessage`

### 14. `event_found`
**Purpose**: Notification when events are detected in text
**Visual**: Amber border and background
**Data**: Event details
**Component**: `EventFoundMessage`

### 15. `ping`
**Purpose**: Keep-alive message for SSE connection
**Visual**: Not rendered (filtered out)
**Component**: Returns `null`

## Adding New Event Types

To add a new event type:

1. Add the type to the `EventMessageData` type union in `event-message.tsx`
2. Add a new case in the main `EventMessage` switch statement
3. Create a new component function (e.g., `MyNewEventMessage`)
4. Update this documentation

## Example Usage

```typescript
// In an agent or orchestrator
emitMessage('status', 'orchestrator', 'Starting analysis', {
  novelName: 'my-novel.txt',
  chunkSize: 2000
});

// Renders as:
// [orchestrator badge] [info icon] [timestamp]
// Starting analysis
// { novelName: 'my-novel.txt', chunkSize: 2000 }
```

## Future Enhancements

Potential improvements to the event system:

- **Severity levels**: Add warning, debug, trace levels
- **Filtering**: Allow users to filter by agent or event type
- **Collapsing**: Collapse verbose events (thinking, tool_call) by default
- **Search**: Search through event messages
- **Export**: Export event log to file for debugging
- **Streaming updates**: Real-time streaming of long-running operations
