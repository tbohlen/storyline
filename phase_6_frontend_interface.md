# Phase 6: Frontend Chat Interface

## Objective
Build a React-based frontend application that displays all AI agent interactions as a chat stream, provides real-time progress monitoring, and enables querying and visualization of the graph database results.

## Technical Requirements

### Dependencies
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.1",
    "@tanstack/react-query": "^5.8.4",
    "socket.io-client": "^4.7.4",
    "axios": "^1.6.2",
    "date-fns": "^2.30.0",
    "framer-motion": "^10.16.5",
    "react-hot-toast": "^2.4.1",
    "react-dropzone": "^14.2.3",
    "react-virtualized": "^9.22.5",
    "d3": "^7.8.5",
    "@types/d3": "^7.4.3",
    "cytoscape": "^3.26.0",
    "cytoscape-cola": "^2.5.1",
    "react-cytoscapejs": "^2.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.37",
    "@types/react-dom": "^18.2.15",
    "@vitejs/plugin-react": "^4.1.1",
    "vite": "^5.0.0",
    "tailwindcss": "^3.3.6",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32"
  }
}
```

## Core Components to Implement

### 1. Main Application Structure
**File**: `src/App.tsx`

Root application component with routing:
```typescript
export interface AppState {
  selectedNovel?: string;
  currentView: 'upload' | 'processing' | 'chat' | 'graph' | 'timeline';
  isConnected: boolean;
  notifications: Notification[];
}

export function App(): JSX.Element {
  const [appState, setAppState] = useState<AppState>({
    currentView: 'upload',
    isConnected: false,
    notifications: []
  });

  return (
    <QueryClient client={queryClient}>
      <Router>
        <div className="min-h-screen bg-gray-100">
          <Header appState={appState} />
          <main className="container mx-auto px-4 py-8">
            <Routes>
              <Route path="/" element={<UploadView />} />
              <Route path="/processing/:novelId" element={<ProcessingView />} />
              <Route path="/chat/:novelId" element={<ChatInterface />} />
              <Route path="/graph/:novelId" element={<GraphVisualization />} />
              <Route path="/timeline/:novelId" element={<TimelineView />} />
            </Routes>
          </main>
          <Toaster position="top-right" />
        </div>
      </Router>
    </QueryClient>
  );
}
```

### 2. File Upload Interface
**File**: `src/components/UploadView.tsx`

Novel and CSV file upload with validation:
```typescript
export interface UploadState {
  novelFile?: File;
  eventsFile?: File;
  novelNumber: number;
  isUploading: boolean;
  uploadProgress: number;
  validationErrors: string[];
}

export function UploadView(): JSX.Element {
  const [uploadState, setUploadState] = useState<UploadState>({
    novelNumber: 1,
    isUploading: false,
    uploadProgress: 0,
    validationErrors: []
  });

  const { mutate: uploadFiles, isLoading } = useMutation({
    mutationFn: async (data: FormData) => {
      return axios.post('/api/v1/upload/novel', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 1)
          );
          setUploadState(prev => ({ ...prev, uploadProgress: progress }));
        }
      });
    },
    onSuccess: (response) => {
      const { sessionId } = response.data.data;
      navigate(`/processing/${sessionId}`);
    },
    onError: (error) => {
      toast.error('Upload failed. Please try again.');
    }
  });

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Novel Timeline Analysis
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <FileDropzone
            accept={{ 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] }}
            onDrop={(files) => setUploadState(prev => ({ ...prev, novelFile: files[0] }))}
            title="Upload Novel (.docx)"
            description="Select the DOCX file containing your novel"
            file={uploadState.novelFile}
          />
          
          <FileDropzone
            accept={{ 'text/csv': ['.csv'] }}
            onDrop={(files) => setUploadState(prev => ({ ...prev, eventsFile: files[0] }))}
            title="Upload Events Reference (.csv)"
            description="Select the CSV file listing major events"
            file={uploadState.eventsFile}
          />
        </div>

        <div className="mt-8">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Novel Number
          </label>
          <select
            value={uploadState.novelNumber}
            onChange={(e) => setUploadState(prev => ({ 
              ...prev, 
              novelNumber: parseInt(e.target.value) 
            }))}
            className="block w-48 px-3 py-2 border border-gray-300 rounded-md"
          >
            {[1, 2, 3, 4, 5].map(num => (
              <option key={num} value={num}>Novel {num}</option>
            ))}
          </select>
        </div>

        {uploadState.validationErrors.length > 0 && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <h3 className="text-sm font-medium text-red-800">Validation Errors:</h3>
            <ul className="mt-2 text-sm text-red-700">
              {uploadState.validationErrors.map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8 flex justify-end">
          <button
            onClick={handleUpload}
            disabled={!uploadState.novelFile || !uploadState.eventsFile || isLoading}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? `Uploading... ${uploadState.uploadProgress}%` : 'Start Processing'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 3. Processing Progress Monitor
**File**: `src/components/ProcessingView.tsx`

Real-time processing progress with phase breakdown:
```typescript
export interface ProcessingPhase {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startedAt?: Date;
  completedAt?: Date;
  stats?: {
    chunks?: number;
    events?: number;
    dates?: number;
    relationships?: number;
  };
}

export function ProcessingView(): JSX.Element {
  const { novelId } = useParams<{ novelId: string }>();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [phases, setPhases] = useState<ProcessingPhase[]>([
    { name: 'Document Processing', status: 'pending', progress: 0 },
    { name: 'Event Detection', status: 'pending', progress: 0 },
    { name: 'Date Assignment', status: 'pending', progress: 0 },
    { name: 'Relationship Assignment', status: 'pending', progress: 0 }
  ]);

  useEffect(() => {
    const newSocket = io(import.meta.env.VITE_API_URL);
    setSocket(newSocket);

    newSocket.emit('join_novel', novelId);

    newSocket.on('processing_update', (data) => {
      updatePhaseProgress(data);
    });

    newSocket.on('processing_completed', (data) => {
      toast.success('Processing completed successfully!');
      navigate(`/chat/${novelId}`);
    });

    return () => {
      newSocket.close();
    };
  }, [novelId]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">
          Processing Novel {novelId}
        </h1>

        <div className="space-y-6">
          {phases.map((phase, index) => (
            <ProcessingPhaseCard
              key={phase.name}
              phase={phase}
              index={index}
            />
          ))}
        </div>

        <div className="mt-8 flex justify-between">
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            ← Back to Upload
          </button>
          
          <button
            onClick={() => navigate(`/chat/${novelId}`)}
            disabled={phases.some(p => p.status === 'running')}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            View Results
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 4. Chat Interface Component
**File**: `src/components/ChatInterface.tsx`

Main chat interface displaying all AI agent interactions:
```typescript
export interface ChatMessage {
  id: string;
  timestamp: Date;
  agentType: 'event_detector' | 'date_assigner' | 'relationship_assigner' | 'system';
  direction: 'prompt' | 'response';
  content: string;
  context?: {
    eventId?: string;
    chunkNumber?: number;
    confidence?: number;
  };
  metadata?: {
    tokenCount?: number;
    processingTime?: number;
    model?: string;
  };
}

export function ChatInterface(): JSX.Element {
  const { novelId } = useParams<{ novelId: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [filter, setFilter] = useState<{
    agentType?: string;
    direction?: string;
    searchTerm?: string;
  }>({});
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);

  const { data: chatLogs, isLoading } = useQuery({
    queryKey: ['chatLogs', novelId, filter],
    queryFn: () => fetchChatLogs(novelId!, filter),
    enabled: !!novelId
  });

  const filteredMessages = useMemo(() => {
    if (!chatLogs) return [];
    
    return chatLogs.filter(message => {
      if (filter.agentType && message.agentType !== filter.agentType) return false;
      if (filter.direction && message.direction !== filter.direction) return false;
      if (filter.searchTerm && !message.content.toLowerCase().includes(filter.searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [chatLogs, filter]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar with filters and stats */}
        <div className="lg:col-span-1">
          <ChatSidebar
            filter={filter}
            onFilterChange={setFilter}
            stats={chatLogs?.length ? calculateChatStats(chatLogs) : null}
            novelId={novelId!}
          />
        </div>

        {/* Main chat area */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-lg">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                AI Agent Conversations
              </h2>
              <p className="text-sm text-gray-600">
                {filteredMessages.length} messages found
              </p>
            </div>

            <div className="h-96 overflow-y-auto p-4 space-y-4">
              <VirtualizedList
                height={600}
                itemCount={filteredMessages.length}
                itemSize={({ index }) => calculateMessageHeight(filteredMessages[index])}
                itemData={filteredMessages}
              >
                {({ index, style, data }) => (
                  <div style={style}>
                    <ChatMessage
                      message={data[index]}
                      onSelect={setSelectedMessage}
                      isSelected={selectedMessage?.id === data[index].id}
                    />
                  </div>
                )}
              </VirtualizedList>
            </div>
          </div>
        </div>

        {/* Message details panel */}
        <div className="lg:col-span-1">
          {selectedMessage && (
            <MessageDetailsPanel
              message={selectedMessage}
              onClose={() => setSelectedMessage(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
```

### 5. Graph Visualization Component
**File**: `src/components/GraphVisualization.tsx`

Interactive graph visualization of events and relationships:
```typescript
export interface GraphNode {
  id: string;
  label: string;
  type: 'event' | 'novel';
  data: {
    description: string;
    novelNumber: number;
    confidence?: number;
    absoluteDate?: Date;
    chunkNumber?: number;
  };
  position?: { x: number; y: number };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: RelationshipType;
  data: {
    confidence: number;
    textEvidence: string;
    temporalMarkers: string[];
  };
}

export function GraphVisualization(): JSX.Element {
  const { novelId } = useParams<{ novelId: string }>();
  const [graphData, setGraphData] = useState<{
    nodes: GraphNode[];
    edges: GraphEdge[];
  }>({ nodes: [], edges: [] });
  const [layout, setLayout] = useState<'force' | 'hierarchical' | 'circular'>('force');
  const [filters, setFilters] = useState<{
    novelNumbers: number[];
    relationshipTypes: RelationshipType[];
    confidenceThreshold: number;
    showDates: boolean;
  }>({
    novelNumbers: [1, 2, 3, 4, 5],
    relationshipTypes: Object.values(RelationshipType),
    confidenceThreshold: 0.5,
    showDates: true
  });

  const { data: rawGraphData } = useQuery({
    queryKey: ['graphData', novelId],
    queryFn: () => fetchGraphData(novelId!),
    enabled: !!novelId
  });

  const cytoscape = useRef<cytoscape.Core | null>(null);

  const cytoscapeElements = useMemo(() => {
    const nodes = graphData.nodes.map(node => ({
      data: {
        id: node.id,
        label: node.label,
        ...node.data
      },
      position: node.position,
      classes: [node.type, node.data.absoluteDate ? 'dated' : 'undated']
    }));

    const edges = graphData.edges.map(edge => ({
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.type,
        ...edge.data
      },
      classes: [edge.type.toLowerCase(), 
                edge.data.confidence > 0.8 ? 'high-confidence' : 'low-confidence']
    }));

    return [...nodes, ...edges];
  }, [graphData]);

  const cytoscapeStylesheet = [
    {
      selector: 'node',
      style: {
        'background-color': '#666',
        'label': 'data(label)',
        'text-valign': 'center',
        'text-halign': 'center',
        'font-size': '12px',
        'width': '60px',
        'height': '60px'
      }
    },
    {
      selector: 'node.event',
      style: {
        'background-color': '#3B82F6',
        'shape': 'ellipse'
      }
    },
    {
      selector: 'node.dated',
      style: {
        'border-width': '3px',
        'border-color': '#10B981'
      }
    },
    {
      selector: 'edge',
      style: {
        'width': 3,
        'line-color': '#ccc',
        'target-arrow-color': '#ccc',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'label': 'data(label)',
        'font-size': '10px'
      }
    },
    {
      selector: 'edge.before',
      style: { 'line-color': '#EF4444', 'target-arrow-color': '#EF4444' }
    },
    {
      selector: 'edge.after',
      style: { 'line-color': '#10B981', 'target-arrow-color': '#10B981' }
    },
    {
      selector: 'edge.simultaneous',
      style: { 'line-color': '#F59E0B', 'target-arrow-color': '#F59E0B' }
    }
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Controls sidebar */}
        <div className="lg:col-span-1">
          <GraphControls
            layout={layout}
            onLayoutChange={setLayout}
            filters={filters}
            onFiltersChange={setFilters}
            onExport={() => exportGraph(cytoscape.current)}
          />
        </div>

        {/* Main graph area */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg shadow-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Event Relationship Graph</h2>
              <div className="flex space-x-2">
                <button
                  onClick={() => fitToScreen()}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                >
                  Fit to Screen
                </button>
                <button
                  onClick={() => resetLayout()}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                >
                  Reset Layout
                </button>
              </div>
            </div>

            <div className="relative h-96 border border-gray-200 rounded">
              <CytoscapeComponent
                elements={cytoscapeElements}
                style={{ width: '100%', height: '100%' }}
                stylesheet={cytoscapeStylesheet}
                layout={{ 
                  name: layout === 'force' ? 'cola' : layout,
                  animate: true,
                  randomize: false
                }}
                cy={(cy) => {
                  cytoscape.current = cy;
                  setupGraphInteractions(cy);
                }}
              />
            </div>

            <GraphLegend />
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 6. Timeline View Component
**File**: `src/components/TimelineView.tsx`

Chronological timeline with conflict highlighting:
```typescript
export interface TimelineEvent {
  id: string;
  name: string;
  description: string;
  date: Date;
  confidence: number;
  novelNumber: number;
  conflicts: string[];
  relationships: {
    before: TimelineEvent[];
    after: TimelineEvent[];
  };
}

export function TimelineView(): JSX.Element {
  const { novelId } = useParams<{ novelId: string }>();
  const [timelineData, setTimelineData] = useState<TimelineEvent[]>([]);
  const [viewMode, setViewMode] = useState<'chronological' | 'narrative'>('chronological');
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [conflictFilter, setConflictFilter] = useState<'all' | 'conflicts_only'>('all');

  const { data: events } = useQuery({
    queryKey: ['timeline', novelId],
    queryFn: () => fetchTimelineData(novelId!),
    enabled: !!novelId
  });

  const { data: conflicts } = useQuery({
    queryKey: ['conflicts', novelId],
    queryFn: () => fetchConflicts(novelId!),
    enabled: !!novelId
  });

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    
    const filtered = conflictFilter === 'conflicts_only'
      ? events.filter(event => event.conflicts.length > 0)
      : events;
    
    return viewMode === 'chronological'
      ? filtered.sort((a, b) => a.date.getTime() - b.date.getTime())
      : filtered.sort((a, b) => a.novelNumber - b.novelNumber);
  }, [events, viewMode, conflictFilter]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Event Timeline
          </h1>
          
          <div className="flex space-x-4">
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as 'chronological' | 'narrative')}
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="chronological">Chronological Order</option>
              <option value="narrative">Narrative Order</option>
            </select>
            
            <select
              value={conflictFilter}
              onChange={(e) => setConflictFilter(e.target.value as 'all' | 'conflicts_only')}
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="all">All Events</option>
              <option value="conflicts_only">Conflicts Only</option>
            </select>
          </div>
        </div>

        {conflicts && conflicts.length > 0 && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <h3 className="text-sm font-medium text-red-800 mb-2">
              Timeline Conflicts Detected ({conflicts.length})
            </h3>
            <div className="space-y-2">
              {conflicts.slice(0, 3).map(conflict => (
                <div key={conflict.id} className="text-sm text-red-700">
                  • {conflict.description}
                </div>
              ))}
              {conflicts.length > 3 && (
                <div className="text-sm text-red-600">
                  ...and {conflicts.length - 3} more
                </div>
              )}
            </div>
          </div>
        )}

        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-300"></div>
          
          <div className="space-y-6">
            {filteredEvents.map((event, index) => (
              <TimelineEventCard
                key={event.id}
                event={event}
                index={index}
                isSelected={selectedEvent?.id === event.id}
                onSelect={setSelectedEvent}
              />
            ))}
          </div>
        </div>

        {selectedEvent && (
          <EventDetailModal
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
          />
        )}
      </div>
    </div>
  );
}
```

### 7. WebSocket Integration
**File**: `src/hooks/useWebSocket.ts`

Real-time communication with backend:
```typescript
export interface WebSocketHook {
  socket: Socket | null;
  isConnected: boolean;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  sendMessage: (event: string, data: any) => void;
}

export function useWebSocket(url: string): WebSocketHook {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const newSocket = io(url);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      toast.success('Connected to server');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      toast.error('Disconnected from server');
    });

    newSocket.on('processing_update', (data) => {
      // Handle processing updates
      queryClient.invalidateQueries({ queryKey: ['processing'] });
    });

    newSocket.on('agent_log', (data) => {
      // Handle new agent log entries
      queryClient.invalidateQueries({ queryKey: ['chatLogs'] });
    });

    newSocket.on('error', (error) => {
      toast.error(`WebSocket error: ${error.message}`);
    });

    return () => {
      newSocket.close();
    };
  }, [url]);

  const joinRoom = useCallback((roomId: string) => {
    socket?.emit('join_room', roomId);
  }, [socket]);

  const leaveRoom = useCallback((roomId: string) => {
    socket?.emit('leave_room', roomId);
  }, [socket]);

  const sendMessage = useCallback((event: string, data: any) => {
    socket?.emit(event, data);
  }, [socket]);

  return {
    socket,
    isConnected,
    joinRoom,
    leaveRoom,
    sendMessage
  };
}
```

### 8. API Integration Layer
**File**: `src/services/api.ts`

Centralized API client with React Query integration:
```typescript
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
  timeout: 30000,
});

// Request interceptor
api.interceptors.request.use((config) => {
  // Add auth headers if needed
  return config;
});

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle authentication errors
    }
    return Promise.reject(error);
  }
);

// API functions
export const apiClient = {
  // Upload functions
  uploadNovel: (formData: FormData) =>
    api.post('/upload/novel', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),

  // Processing functions
  startProcessing: (sessionId: string) =>
    api.post(`/upload/process/${sessionId}`),
  
  getProcessingStatus: (sessionId: string) =>
    api.get(`/upload/status/${sessionId}`),

  // Event functions
  getEvents: (novelId: string) =>
    api.get(`/events/novel/${novelId}`),
  
  detectEvents: (novelId: string, options: any) =>
    api.post(`/events/detect/${novelId}`, options),

  // Date functions
  assignDates: (novelId: string, options: any) =>
    api.post(`/dates/assign/${novelId}`, options),
  
  getTimeline: (novelId: string) =>
    api.get(`/dates/timeline/${novelId}`),
  
  getConflicts: (novelId: string) =>
    api.get(`/dates/conflicts/${novelId}`),

  // Relationship functions
  assignRelationships: (novelId: string, options: any) =>
    api.post(`/relationships/assign/${novelId}`, options),
  
  getGraphData: (novelId: string) =>
    api.get(`/relationships/novel/${novelId}`),

  // Chat functions
  getChatLogs: (novelId: string, filters?: any) =>
    api.get(`/agent-logs/novel/${novelId}`, { params: filters }),
  
  searchLogs: (query: string, agentType?: string) =>
    api.get('/agent-logs/search', { params: { query, agentType } }),
};
```

## Styling and Design System

### Tailwind Configuration
**File**: `tailwind.config.js`

```javascript
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8'
        },
        success: {
          50: '#f0fdf4',
          500: '#10b981',
          600: '#059669'
        },
        warning: {
          50: '#fffbeb',
          500: '#f59e0b',
          600: '#d97706'
        },
        error: {
          50: '#fef2f2',
          500: '#ef4444',
          600: '#dc2626'
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s infinite',
        'fadeIn': 'fadeIn 0.5s ease-in-out',
        'slideUp': 'slideUp 0.3s ease-out'
      }
    }
  },
  plugins: []
};
```

### Component Styling Patterns
```css
/* Chat message styling */
.chat-message {
  @apply p-4 rounded-lg border transition-all duration-200;
}

.chat-message.prompt {
  @apply bg-blue-50 border-blue-200 ml-8;
}

.chat-message.response {
  @apply bg-green-50 border-green-200 mr-8;
}

.chat-message.selected {
  @apply ring-2 ring-blue-500 shadow-lg;
}

/* Timeline styling */
.timeline-event {
  @apply relative pl-16 pb-8;
}

.timeline-event.conflict {
  @apply bg-red-50 border-l-4 border-red-500;
}

.timeline-dot {
  @apply absolute left-6 w-4 h-4 rounded-full border-4 border-white shadow-md;
}

/* Graph controls */
.graph-control {
  @apply p-3 bg-gray-50 rounded-md border hover:bg-gray-100 transition-colors;
}
```

## Testing Strategy

### Unit Tests
**File**: `src/components/__tests__/ChatInterface.test.tsx`

```typescript
describe('ChatInterface', () => {
  it('should render chat messages correctly', () => {
    const mockMessages = createMockChatMessages();
    
    render(
      <QueryClient client={testQueryClient}>
        <MemoryRouter initialEntries={['/chat/test-novel']}>
          <ChatInterface />
        </MemoryRouter>
      </QueryClient>
    );

    expect(screen.getByText('AI Agent Conversations')).toBeInTheDocument();
    expect(screen.getByText(`${mockMessages.length} messages found`)).toBeInTheDocument();
  });

  it('should filter messages by agent type', async () => {
    render(<ChatInterface />);
    
    const filter = screen.getByRole('combobox', { name: /agent type/i });
    fireEvent.change(filter, { target: { value: 'event_detector' } });

    await waitFor(() => {
      expect(screen.queryByText('date_assigner')).not.toBeInTheDocument();
    });
  });
});
```

### E2E Tests
**File**: `cypress/e2e/novel-processing-flow.cy.ts`

```typescript
describe('Novel Processing Flow', () => {
  it('should complete full processing workflow', () => {
    cy.visit('/');
    
    // Upload files
    cy.get('[data-testid="novel-dropzone"]')
      .selectFile('fixtures/test-novel.docx');
    cy.get('[data-testid="events-dropzone"]')
      .selectFile('fixtures/test-events.csv');
    
    cy.get('[data-testid="novel-number"]').select('1');
    cy.get('[data-testid="start-processing"]').click();

    // Monitor processing
    cy.url().should('include', '/processing/');
    cy.get('[data-testid="processing-phase"]').should('have.length', 4);
    
    // Wait for completion
    cy.get('[data-testid="view-results"]', { timeout: 60000 })
      .should('not.be.disabled');
    
    // View chat interface
    cy.get('[data-testid="view-results"]').click();
    cy.url().should('include', '/chat/');
    
    // Verify chat messages exist
    cy.get('[data-testid="chat-message"]').should('have.length.greaterThan', 0);
  });
});
```

## Performance Optimization

### Virtual Scrolling
- Implement virtual scrolling for large chat logs
- Lazy load message details on demand
- Paginate graph data for large networks

### Caching Strategy
- Cache API responses with React Query
- Store user preferences in localStorage
- Implement service worker for offline capability

### Bundle Optimization
- Code splitting by route
- Lazy load graph visualization libraries
- Optimize image and asset loading

## Deployment Configuration

### Vite Configuration
**File**: `vite.config.ts`

```typescript
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          graph: ['d3', 'cytoscape'],
          query: ['@tanstack/react-query', 'axios']
        }
      }
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true
      }
    }
  }
});
```

### Docker Configuration
**File**: `Dockerfile`

```dockerfile
FROM node:18-alpine as builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## Acceptance Criteria

### Functional Requirements
- ✅ Upload and validate DOCX and CSV files
- ✅ Monitor real-time processing progress
- ✅ Display all AI agent interactions as chat
- ✅ Filter and search chat messages effectively
- ✅ Visualize event relationships as interactive graph
- ✅ Show chronological timeline with conflict detection
- ✅ Export results and visualizations

### User Experience Requirements
- ✅ Responsive design for mobile and desktop
- ✅ Intuitive navigation between views
- ✅ Real-time updates without page refresh
- ✅ Clear error messaging and validation
- ✅ Accessible interface following WCAG guidelines

### Performance Requirements
- ✅ Initial page load under 3 seconds
- ✅ Chat interface handles 1000+ messages smoothly
- ✅ Graph visualization renders 500+ nodes efficiently
- ✅ WebSocket connections remain stable during processing
- ✅ Bundle size under 2MB gzipped

## Deliverables

1. **Core Interface Components**
   - File upload with validation and progress
   - Real-time processing monitoring
   - Chat interface with filtering and search
   - Graph visualization with layout controls
   - Timeline view with conflict highlighting

2. **Real-time Communication**
   - WebSocket integration for live updates
   - Progress monitoring across all phases
   - Agent interaction streaming

3. **Data Visualization**
   - Interactive graph with relationship types
   - Chronological timeline with date conflicts
   - Export capabilities for results

4. **User Experience**
   - Responsive design and accessibility
   - Error handling and validation
   - Performance optimization and caching

This phase completes the project by providing an intuitive, powerful interface for users to monitor AI processing and explore the resulting timeline analysis and relationship graphs across their novel series.