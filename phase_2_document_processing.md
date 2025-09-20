# Phase 2: Document Processing System

## Objective
Implement DOCX file processing, text chunking with overlap, CSV parsing for events reference, and file management utilities to prepare documents for AI agent processing.

## Technical Requirements

### Additional Dependencies
```json
{
  "dependencies": {
    "node-word-extractor": "^0.1.3",
    "csv-parser": "^3.0.0",
    "multer": "^1.4.5-lts.1",
    "sharp": "^0.32.6",
    "archiver": "^6.0.1",
    "fs-extra": "^11.1.1"
  },
  "devDependencies": {
    "@types/multer": "^1.4.11",
    "@types/fs-extra": "^11.0.4"
  }
}
```

## Core Components to Implement

### 1. DOCX Text Extraction Service
**File**: `src/services/document-extractor.ts`

Extract and process text from DOCX files:
- Full text extraction with character position tracking
- Metadata extraction (title, author, word count)
- Error handling for corrupted files
- Support for different DOCX formats

```typescript
export interface DocumentContent {
  text: string;
  metadata: {
    title?: string;
    author?: string;
    wordCount: number;
    characterCount: number;
    pageCount?: number;
  };
  extractedAt: Date;
}

export class DocumentExtractor {
  async extractText(filePath: string): Promise<DocumentContent>;
  async validateDocx(filePath: string): Promise<boolean>;
  private cleanText(rawText: string): string;
  private extractMetadata(doc: any): DocumentContent['metadata'];
}
```

### 2. Text Chunking Service
**File**: `src/services/text-chunker.ts`

Split documents into overlapping chunks:
- Configurable chunk size and overlap
- Preserve sentence boundaries when possible
- Track character positions in original text
- Generate chunk metadata

```typescript
export interface TextChunk {
  id: string;
  novelId: string;
  chunkNumber: number;
  content: string;
  characterStart: number;
  characterEnd: number;
  wordCount: number;
  sentenceCount: number;
  overlap: {
    withPrevious: string;
    withNext: string;
  };
}

export interface ChunkingOptions {
  maxChunkSize: number;        // Default: 2000 characters
  overlapSize: number;         // Default: 200 characters
  preserveSentences: boolean;  // Default: true
  minChunkSize: number;        // Default: 500 characters
}

export class TextChunker {
  async chunkText(
    text: string, 
    novelId: string, 
    options: ChunkingOptions
  ): Promise<TextChunk[]>;
  
  private findSentenceBoundary(text: string, position: number): number;
  private calculateOverlap(chunks: TextChunk[]): void;
  private validateChunks(chunks: TextChunk[]): boolean;
}
```

### 3. CSV Events Parser
**File**: `src/services/csv-parser.ts`

Parse and validate events CSV file:
- Flexible column mapping
- Data validation and cleaning
- Error reporting for invalid rows
- Support for different CSV formats

```typescript
export interface EventCSVRow {
  rowNumber: number;
  eventId: string;
  eventName: string;
  description: string;
  novelNumber?: number;
  category?: string;
  notes?: string;
  originalRow: Record<string, string>;
}

export interface CSVParseResult {
  success: boolean;
  data: EventCSVRow[];
  errors: CSVError[];
  metadata: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    columnMapping: Record<string, string>;
  };
}

export interface CSVError {
  row: number;
  column?: string;
  message: string;
  severity: 'warning' | 'error';
}

export class CSVParser {
  async parseEventsCSV(filePath: string): Promise<CSVParseResult>;
  private detectColumnMapping(headers: string[]): Record<string, string>;
  private validateRow(row: any, rowNumber: number): CSVError[];
  private cleanRowData(row: any): EventCSVRow;
}
```

### 4. File Upload Handler
**File**: `src/services/file-handler.ts`

Manage file uploads and storage:
- Secure file upload with validation
- Temporary file management
- File type detection and validation
- Storage organization by novel/session

```typescript
export interface UploadedFile {
  id: string;
  originalName: string;
  filename: string;
  path: string;
  size: number;
  mimeType: string;
  uploadedAt: Date;
}

export interface ProcessingSession {
  id: string;
  novelFile: UploadedFile;
  eventsFile: UploadedFile;
  novelNumber: number;
  status: 'uploaded' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
}

export class FileHandler {
  async uploadFiles(
    novelFile: Express.Multer.File,
    eventsFile: Express.Multer.File,
    novelNumber: number
  ): Promise<ProcessingSession>;
  
  async validateUpload(file: Express.Multer.File, type: 'docx' | 'csv'): Promise<void>;
  async cleanupSession(sessionId: string): Promise<void>;
  async getSessionFiles(sessionId: string): Promise<ProcessingSession>;
}
```

### 5. Novel Processing Service  
**File**: `src/services/novel-processor.ts`

Orchestrate complete novel processing:
- Extract text from DOCX
- Parse events CSV  
- Create chunks with overlap
- Store in database
- Track processing progress

```typescript
export interface ProcessingProgress {
  sessionId: string;
  status: 'starting' | 'extracting' | 'chunking' | 'storing' | 'completed' | 'failed';
  progress: {
    currentStep: string;
    completedSteps: number;
    totalSteps: number;
    message: string;
  };
  results?: {
    novelId: string;
    chunkCount: number;
    eventCount: number;
    wordCount: number;
  };
  error?: string;
}

export class NovelProcessor {
  async processNovel(sessionId: string): Promise<ProcessingProgress>;
  async getProcessingStatus(sessionId: string): Promise<ProcessingProgress>;
  
  private async extractAndStoreText(session: ProcessingSession): Promise<string>;
  private async createAndStoreChunks(text: string, novelId: string): Promise<number>;
  private async storeEventsReference(csvPath: string, novelId: string): Promise<number>;
  private emitProgress(sessionId: string, progress: ProcessingProgress): void;
}
```

## Database Integration

### Novel Repository
**File**: `src/repositories/novel-repository.ts`

Database operations for novels and chunks:
```typescript
export class NovelRepository {
  async createNovel(novel: Omit<INovel, 'id'>): Promise<string>;
  async createChunk(chunk: Omit<ITextChunk, 'id'>): Promise<string>;
  async getNovelWithChunks(novelId: string): Promise<INovel & { chunks: ITextChunk[] }>;
  async updateNovelStatus(novelId: string, status: INovel['status']): Promise<void>;
  async findNovelByNumber(novelNumber: number): Promise<INovel | null>;
  async getChunkById(chunkId: string): Promise<ITextChunk | null>;
  async getChunksByNovel(novelId: string): Promise<ITextChunk[]>;
}
```

### Events Reference Repository
**File**: `src/repositories/events-reference-repository.ts`

Store CSV events data for reference:
```typescript
export class EventsReferenceRepository {
  async storeEventsCSV(csvData: EventCSVRow[], novelId: string): Promise<void>;
  async findEventByName(eventName: string, novelNumber?: number): Promise<EventCSVRow | null>;
  async searchEvents(query: string, novelNumber?: number): Promise<EventCSVRow[]>;
  async getAllEvents(novelNumber?: number): Promise<EventCSVRow[]>;
}
```

## API Endpoints

### File Upload API
**File**: `src/routes/api/upload.ts`

Handle file uploads and processing:
```typescript
// POST /api/v1/upload/novel
router.post('/novel', upload.fields([
  { name: 'novelFile', maxCount: 1 },
  { name: 'eventsFile', maxCount: 1 }
]), async (req, res) => {
  const { novelNumber } = req.body;
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  
  const session = await fileHandler.uploadFiles(
    files.novelFile[0],
    files.eventsFile[0], 
    parseInt(novelNumber)
  );
  
  res.json({
    success: true,
    data: { sessionId: session.id }
  });
});

// POST /api/v1/upload/process/:sessionId
router.post('/process/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const progress = await novelProcessor.processNovel(sessionId);
  
  res.json({
    success: true,
    data: progress
  });
});

// GET /api/v1/upload/status/:sessionId  
router.get('/status/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const status = await novelProcessor.getProcessingStatus(sessionId);
  
  res.json({
    success: true,
    data: status
  });
});
```

### Document Query API
**File**: `src/routes/api/documents.ts`

Query processed documents:
```typescript
// GET /api/v1/documents/novels
router.get('/novels', async (req, res) => {
  const novels = await novelRepository.findAll();
  res.json({ success: true, data: novels });
});

// GET /api/v1/documents/novels/:id/chunks
router.get('/novels/:id/chunks', async (req, res) => {
  const chunks = await novelRepository.getChunksByNovel(req.params.id);
  res.json({ success: true, data: chunks });
});

// GET /api/v1/documents/events/search
router.get('/events/search', async (req, res) => {
  const { q, novelNumber } = req.query;
  const events = await eventsRepository.searchEvents(
    q as string, 
    novelNumber ? parseInt(novelNumber as string) : undefined
  );
  res.json({ success: true, data: events });
});
```

## File Management

### Storage Structure
```
uploads/
├── sessions/
│   ├── {session-id}/
│   │   ├── novel.docx
│   │   ├── events.csv
│   │   └── metadata.json
└── processed/
    ├── {novel-id}/
    │   ├── full-text.txt
    │   ├── chunks/
    │   │   ├── chunk-001.txt
    │   │   ├── chunk-002.txt
    │   │   └── ...
    │   └── events-reference.json
```

### Cleanup Service
**File**: `src/services/cleanup-service.ts`

Manage temporary files and old sessions:
```typescript
export class CleanupService {
  async cleanupOldSessions(olderThan: Date): Promise<number>;
  async cleanupFailedProcessing(): Promise<void>;
  async archiveCompletedSessions(sessionIds: string[]): Promise<void>;
  private async removeDirectory(path: string): Promise<void>;
}
```

## Validation and Error Handling

### File Validation
**File**: `src/utils/file-validators.ts`

Comprehensive file validation:
```typescript
export class FileValidator {
  static validateDocx(file: Express.Multer.File): ValidationResult;
  static validateCSV(file: Express.Multer.File): ValidationResult;
  static async validateDocxContent(filePath: string): Promise<ValidationResult>;
  static async validateCSVContent(filePath: string): Promise<ValidationResult>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: any;
}
```

### Processing Error Handling
```typescript
export class ProcessingError extends BaseError {
  constructor(
    message: string,
    public sessionId: string,
    public step: string
  ) {
    super(message, 'PROCESSING_ERROR', 422);
  }
}

export class FileValidationError extends BaseError {
  constructor(
    message: string,
    public filename: string,
    public validationErrors: string[]
  ) {
    super(message, 'FILE_VALIDATION_ERROR', 400);
  }
}
```

## Testing

### Unit Tests
**File**: `src/tests/unit/document-extractor.test.ts`

Test document extraction:
```typescript
describe('DocumentExtractor', () => {
  let extractor: DocumentExtractor;
  
  beforeEach(() => {
    extractor = new DocumentExtractor();
  });
  
  it('should extract text from valid DOCX', async () => {
    const content = await extractor.extractText('tests/fixtures/sample.docx');
    
    expect(content.text).toBeDefined();
    expect(content.metadata.wordCount).toBeGreaterThan(0);
    expect(content.metadata.characterCount).toBeGreaterThan(0);
  });
  
  it('should handle corrupted DOCX files', async () => {
    await expect(extractor.extractText('tests/fixtures/corrupted.docx'))
      .rejects.toThrow(DocumentProcessingError);
  });
});
```

### Integration Tests
**File**: `src/tests/integration/novel-processing.test.ts`

Test complete processing workflow:
```typescript
describe('Novel Processing Integration', () => {
  it('should process novel from upload to chunks', async () => {
    // Upload files
    const response = await request(app)
      .post('/api/v1/upload/novel')
      .attach('novelFile', 'tests/fixtures/test-novel.docx')
      .attach('eventsFile', 'tests/fixtures/test-events.csv')
      .field('novelNumber', '1')
      .expect(200);
    
    const { sessionId } = response.body.data;
    
    // Process novel
    await request(app)
      .post(`/api/v1/upload/process/${sessionId}`)
      .expect(200);
    
    // Verify chunks were created
    const novels = await novelRepository.findAll();
    expect(novels).toHaveLength(1);
    
    const chunks = await novelRepository.getChunksByNovel(novels[0].id);
    expect(chunks.length).toBeGreaterThan(0);
  });
});
```

## Performance Considerations

### Chunking Performance
- Process large documents in streaming fashion
- Use worker threads for CPU-intensive operations
- Implement progress tracking for long operations

### Memory Management
- Process files without loading entirely into memory
- Clean up temporary files promptly
- Use streaming for large file operations

## Acceptance Criteria

### Functional Requirements
- ✅ Successfully extract text from DOCX files up to 50MB
- ✅ Create overlapping chunks with configurable size
- ✅ Parse CSV files with various column formats
- ✅ Store processed data in Neo4j database
- ✅ Track processing progress in real-time
- ✅ Handle file upload errors gracefully

### Quality Requirements
- ✅ Process novels up to 500,000 words
- ✅ Maintain character position accuracy
- ✅ Preserve text formatting where relevant
- ✅ Validate all input files before processing
- ✅ 90%+ test coverage for core processing logic

### Performance Requirements
- ✅ Process 100,000 word novel in under 2 minutes
- ✅ Chunk overlap calculation accuracy 99%+
- ✅ Support concurrent processing of multiple novels
- ✅ Memory usage under 500MB per processing session

## Deliverables

1. **Document Processing Services**
   - DOCX text extraction
   - Text chunking with overlap
   - CSV parsing and validation

2. **File Management**
   - Upload handling and validation
   - Temporary file management
   - Storage organization

3. **Database Integration**
   - Novel and chunk repositories
   - Events reference storage
   - Processing status tracking

4. **API Endpoints**
   - File upload endpoints
   - Processing status queries
   - Document and events search

This phase provides robust document processing capabilities that prepare novels for AI agent analysis while maintaining data integrity and performance.