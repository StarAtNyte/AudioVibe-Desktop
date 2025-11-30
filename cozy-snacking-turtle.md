# Ebook Reader Implementation Plan for AudioVibe-Desktop

## Overview
Add a full-featured ebook reader to AudioVibe-Desktop with separate library management, elegant reading interface, fullscreen capability (inspired by Readest), and real-time TTS integration. This leverages existing infrastructure (epubjs, pdfjs-dist, TTS service) while maintaining clean separation from the audiobook system.

## Architecture Decisions

### 1. Separate Ebook System
- **Separate database tables** for ebooks (not reusing audiobooks table)
- **Separate Zustand stores** for ebook library and reader state
- **Separate navigation** ("Ebooks" section in sidebar)
- **Rationale**: Different content types require different features (annotations vs chapters), different progress tracking (page/CFI vs audio position), and prevents confusion

### 2. Real-time TTS Strategy
- **On-demand streaming generation** rather than pre-converting entire books
- Generate first 3 sentences immediately, play while generating rest in background
- **Rationale**: Instant start, storage efficient, allows voice/speed changes on-the-fly

### 3. Rendering Strategy
- **EPUB**: epubjs library (already installed) with paginated flow
- **PDF**: pdfjs-dist (already installed) with canvas rendering + text layer overlay
- **Rationale**: Industry-standard libraries, text selection support, accurate rendering

---

## Database Schema

### New Migration: `20240103000001_create_ebooks_tables.sql`

```sql
-- Main ebook metadata (separate from audiobooks)
CREATE TABLE ebooks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT,
    file_path TEXT NOT NULL,
    file_format TEXT NOT NULL, -- 'pdf' or 'epub'
    cover_path TEXT,
    total_pages INTEGER,
    file_size INTEGER,
    language TEXT,
    publisher TEXT,
    publication_date TEXT,
    description TEXT,
    added_date TEXT NOT NULL,
    modified_date TEXT NOT NULL
);

-- Reading progress tracking
CREATE TABLE reading_progress (
    id TEXT PRIMARY KEY,
    ebook_id TEXT NOT NULL,
    current_page INTEGER, -- for PDF
    current_cfi TEXT, -- for EPUB (Canonical Fragment Identifier)
    current_chapter_href TEXT, -- fallback for EPUB
    percentage_complete REAL,
    reading_time_seconds INTEGER DEFAULT 0,
    last_read_date TEXT NOT NULL,
    FOREIGN KEY (ebook_id) REFERENCES ebooks(id) ON DELETE CASCADE
);

-- Bookmarks
CREATE TABLE ebook_bookmarks (
    id TEXT PRIMARY KEY,
    ebook_id TEXT NOT NULL,
    page_number INTEGER, -- for PDF
    cfi TEXT, -- for EPUB
    chapter_title TEXT,
    note TEXT,
    created_date TEXT NOT NULL,
    FOREIGN KEY (ebook_id) REFERENCES ebooks(id) ON DELETE CASCADE
);

-- Annotations (highlights and notes)
CREATE TABLE ebook_annotations (
    id TEXT PRIMARY KEY,
    ebook_id TEXT NOT NULL,
    annotation_type TEXT NOT NULL, -- 'highlight', 'underline', 'note'
    color TEXT, -- for highlights
    cfi_range TEXT, -- EPUB selection range
    position_data TEXT, -- JSON for PDF coordinates
    selected_text TEXT,
    note TEXT,
    created_date TEXT NOT NULL,
    FOREIGN KEY (ebook_id) REFERENCES ebooks(id) ON DELETE CASCADE
);

-- Per-book reader settings
CREATE TABLE ebook_reader_settings (
    ebook_id TEXT PRIMARY KEY,
    font_family TEXT DEFAULT 'serif',
    font_size INTEGER DEFAULT 18,
    line_height REAL DEFAULT 1.6,
    theme TEXT DEFAULT 'light', -- 'light', 'dark', 'sepia'
    flow_mode TEXT DEFAULT 'paginated', -- 'paginated' or 'scrolled'
    FOREIGN KEY (ebook_id) REFERENCES ebooks(id) ON DELETE CASCADE
);
```

---

## State Management

### 1. Ebook Library Store (`src/store/ebook.ts`)
Manages ebook collection (mirrors `library.ts` pattern)

**State**:
- `ebooks: Ebook[]`
- `currentEbookId: string | null`
- `isLoading: boolean`
- `error: string | null`

**Actions**:
- `fetchEbooks(): Promise<void>`
- `addEbook(ebook: CreateEbookDto): Promise<void>`
- `deleteEbook(id: string): Promise<void>`
- `updateEbook(id: string, updates: Partial<Ebook>): Promise<void>`
- `searchEbooks(query: string): Ebook[]`

### 2. Reader State Store (`src/store/reader.ts`)
Manages active reading session

**State**:
- `currentEbook: Ebook | null`
- `currentPage: number` (PDF)
- `currentCFI: string | null` (EPUB)
- `totalPages: number`
- `isFullscreen: boolean`
- `readerSettings: ReaderSettings`
- `bookmarks: Bookmark[]`
- `annotations: Annotation[]`
- `showTOC: boolean`
- `showBookmarks: boolean`
- `showAnnotations: boolean`

**Actions**:
- `loadEbook(id: string): Promise<void>`
- `setPage(page: number): void`
- `setCFI(cfi: string): void`
- `toggleFullscreen(): void`
- `updateSettings(settings: Partial<ReaderSettings>): void`
- `addBookmark(bookmark: CreateBookmarkDto): Promise<void>`
- `addAnnotation(annotation: CreateAnnotationDto): Promise<void>`
- `saveProgress(): Promise<void>` (auto-called every 30s)

### 3. TTS Reader Store (`src/store/ttsReader.ts`)
Manages TTS playback during reading

**State**:
- `isPlaying: boolean`
- `currentSentenceIndex: number`
- `sentences: string[]`
- `audioQueue: HTMLAudioElement[]`
- `voice: string`
- `speed: number`

**Actions**:
- `startTTS(text: string): Promise<void>`
- `pauseTTS(): void`
- `resumeTTS(): void`
- `stopTTS(): void`
- `seekToSentence(index: number): void`
- `setVoice(voice: string): void`
- `setSpeed(speed: number): void`

---

## Component Structure

```
src/
├── pages/
│   ├── Ebooks.tsx                    # Ebook library page (NEW)
│   └── Reader.tsx                    # Main reader page (NEW)
│
├── components/
│   ├── ebooks/                       # Ebook library components (NEW)
│   │   ├── EbookLibraryView.tsx     # Grid/list view (mirrors LibraryView pattern)
│   │   ├── EbookCard.tsx            # Individual ebook card with cover
│   │   ├── EbookImportModal.tsx     # Import PDF/EPUB files
│   │   └── EbookDetailsModal.tsx    # Edit ebook metadata
│   │
│   └── reader/                       # Reader components (NEW)
│       ├── EbookReader.tsx          # Main orchestrator component
│       ├── PDFReader.tsx            # PDF.js rendering implementation
│       ├── EPUBReader.tsx           # Epub.js rendering implementation
│       ├── ReaderTopBar.tsx         # Title, settings icon, fullscreen toggle
│       ├── ReaderControls.tsx       # Bottom controls (page nav, zoom)
│       ├── TableOfContents.tsx      # Left sidebar TOC navigation
│       ├── ReaderSettings.tsx       # Font, theme, layout settings panel
│       ├── BookmarkPanel.tsx        # Right sidebar bookmarks list
│       ├── AnnotationPanel.tsx      # Annotations list/management
│       ├── AnnotationTools.tsx      # Highlight/underline/note toolbar
│       ├── SearchPanel.tsx          # In-book search
│       ├── TTSControls.tsx          # Play/pause, voice, speed controls
│       ├── SentenceHighlighter.tsx  # Visual highlighting during TTS
│       └── PageNavigator.tsx        # Page/chapter navigation widget
│
├── store/
│   ├── ebook.ts                      # Ebook library state (NEW)
│   ├── reader.ts                     # Reader session state (NEW)
│   └── ttsReader.ts                  # TTS playback state (NEW)
│
└── types/
    └── ebook.ts                      # Ebook type definitions (NEW)
```

---

## UI/UX Design

### Ebook Library Page (`/ebooks`)
- **Header**: "My Ebooks" + "Import Ebook" button
- **Search bar** with filters (format: PDF/EPUB, author, genre)
- **Grid/List toggle** (reuse existing pattern)
- **Sort options**: Title, Author, Date Added, Recently Read
- **Ebook cards**: Cover, title, author, reading progress indicator

### Reader Page (`/reader/:id`)

**Normal Mode** (three-panel layout):
- **Left panel**: Table of Contents (collapsible)
- **Center panel**: Book content with annotation overlay
- **Right panel**: Bookmarks/Annotations (toggleable)
- **Top bar**: Book title, settings icon, fullscreen button
- **Bottom bar**: Page navigation + TTS controls

**Fullscreen Mode** (immersive):
- **Auto-hiding controls** (appear on mouse move, hide after 3s)
- **Top bar**: Minimal (title, settings, exit fullscreen)
- **Bottom bar**: Page navigation, TTS controls
- **Side panels**: Overlay drawers (slide in from sides)
- **Keyboard shortcuts**: Esc (exit), F (fullscreen), arrows (navigate)

---

## Rendering Implementation

### EPUB Rendering (`EPUBReader.tsx`)

```typescript
import ePub from 'epubjs';

const book = ePub(ebookPath);
const rendition = book.renderTo(containerRef.current, {
  width: '100%',
  height: '100%',
  flow: 'paginated', // or 'scrolled-doc'
});

await rendition.display(savedCFI || undefined);

// Track location changes
rendition.on('relocated', (location) => {
  readerStore.setCFI(location.start.cfi);
  readerStore.saveProgress(); // debounced
});

// Apply custom theme
rendition.themes.register('custom', {
  body: {
    'font-family': settings.fontFamily,
    'font-size': `${settings.fontSize}px`,
    'line-height': settings.lineHeight,
    'color': settings.textColor,
    'background': settings.backgroundColor,
  }
});
rendition.themes.select('custom');
```

**Features**:
- CFI-based position tracking (precise, device-independent)
- Built-in TOC via `book.navigation.toc`
- Text selection for annotations
- Theme customization

### PDF Rendering (`PDFReader.tsx`)

```typescript
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

const pdf = await pdfjsLib.getDocument(ebookPath).promise;
const page = await pdf.getPage(pageNumber);
const viewport = page.getViewport({ scale: zoomLevel });

// Render to canvas
const canvas = canvasRef.current;
const context = canvas.getContext('2d');
canvas.height = viewport.height;
canvas.width = viewport.width;

await page.render({ canvasContext: context, viewport }).promise;

// Add text layer for selection
const textContent = await page.getTextContent();
renderTextLayer(textContent, viewport);
```

**Optimization**: Virtual scrolling (only render visible pages + 1 buffer page)

---

## TTS Integration

### Streaming TTS Architecture

**Flow**:
1. User clicks "Read Aloud" button
2. Extract text from current page/section
3. Split into sentences using natural language processing
4. Generate audio for first 3 sentences (immediate)
5. Start playback of sentence 1
6. Generate remaining sentences in background queue
7. Highlight current sentence in sync with audio
8. Auto-advance page when reaching end

### Sentence Highlighting

**EPUB** (using epub.js annotations):
```typescript
rendition.annotations.add(
  'highlight',
  cfiRange,
  {},
  undefined,
  'tts-highlight' // CSS class
);
```

**PDF** (overlay div):
```typescript
<div
  className="absolute pointer-events-none bg-yellow-300/30"
  style={{
    left: textBounds.left,
    top: textBounds.top,
    width: textBounds.width,
    height: textBounds.height,
  }}
/>
```

### TTS Controls
- Play/Pause button
- Voice selector (VibeVoice API voices)
- Speed slider (0.5x - 2x)
- Sentence progress indicator
- Skip forward/backward by sentence
- Stop button (return to manual reading)

---

## Backend (Rust/Tauri)

### New File: `src-tauri/src/ebook/mod.rs`

**Modules**:
- `metadata.rs` - Extract metadata from PDF/EPUB
- `models.rs` - Rust structs for Ebook, Bookmark, Annotation

### New File: `src-tauri/src/commands/ebook_commands.rs`

**Commands**:
```rust
#[tauri::command]
async fn import_ebook_file(source_path: String, metadata: EbookMetadata) -> Result<String, String>;

#[tauri::command]
async fn extract_ebook_metadata(file_path: String) -> Result<EbookMetadata, String>;

#[tauri::command]
async fn get_all_ebooks(db: State<Database>) -> Result<Vec<Ebook>, String>;

#[tauri::command]
async fn create_ebook(dto: CreateEbookDto) -> Result<Ebook, String>;

#[tauri::command]
async fn update_reading_progress(ebook_id: String, dto: UpdateProgressDto) -> Result<(), String>;

#[tauri::command]
async fn create_bookmark(dto: CreateBookmarkDto) -> Result<Bookmark, String>;

#[tauri::command]
async fn get_ebook_bookmarks(ebook_id: String) -> Result<Vec<Bookmark>, String>;

#[tauri::command]
async fn create_annotation(dto: CreateAnnotationDto) -> Result<Annotation, String>;

#[tauri::command]
async fn get_ebook_annotations(ebook_id: String) -> Result<Vec<Annotation>, String>;
```

### Database Repository Pattern

**File**: `src-tauri/src/database/repository.rs`

Add:
- `EbookRepository` - CRUD for ebooks
- `ReadingProgressRepository` - Save/load progress
- `BookmarkRepository` - Bookmark management
- `AnnotationRepository` - Annotation management

---

## Reader Features

### 1. Font Customization
- **Font Family**: System, Serif, Sans-Serif, Monospace
- **Font Size**: 12-32px slider
- **Line Height**: 1.2-2.0
- **Letter Spacing**: -0.5 to 2px
- **Text Alignment**: Left, Justify

**Persistence**: Saved per-book in `ebook_reader_settings` table

### 2. Theme Support
- **Light**: White background, black text
- **Dark**: Dark gray background, light text
- **Sepia**: Beige background, brown text
- **Custom**: User-defined colors

### 3. Table of Contents
- **EPUB**: Extract from `book.navigation.toc`
- **PDF**: Use outline/bookmarks if available, fallback to page numbers
- **UI**: Collapsible tree in left sidebar, click to navigate

### 4. Bookmarks
- Click bookmark icon to save current position
- Auto-capture page/CFI, chapter title
- Optional note field
- Bookmark panel shows list with thumbnails
- Click to jump to location

### 5. Annotations
- **Text Selection**: Detect via mouseup event
- **Toolbar**: Highlight (4 colors), Underline, Add Note, Copy
- **Storage**: EPUB (CFI range), PDF (page + bounding box)
- **Rendering**: EPUB (annotations API), PDF (overlay divs)

### 6. Reading Progress
- Auto-save every 30 seconds
- Track page/CFI, percentage complete, reading time
- Resume reading on book open

### 7. Search Within Book
- **EPUB**: Search across all spine items
- **PDF**: Search page by page text content
- **UI**: Search panel with results list, click to navigate

### 8. Fullscreen Mode
- Enter: F key or fullscreen button
- Exit: Esc key
- Auto-hide controls after 3s of no mouse movement
- Keyboard shortcuts remain active

---

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
**Goal**: Database foundation and basic data flow

- Create database migration (`20240103000001_create_ebooks_tables.sql`)
- Create type definitions (`src/types/ebook.ts`, `src-tauri/src/ebook/models.rs`)
- Create ebook Zustand store (`src/store/ebook.ts`)
- Implement basic Tauri commands (create, fetch ebooks)
- Add ebook metadata extraction in Rust

**Test**: Import ebook file, verify database entry

### Phase 2: Ebook Library UI (Week 2)
**Goal**: Users can import and browse ebooks

- Create Ebooks page (`src/pages/Ebooks.tsx`)
- Create library view component (`src/components/ebooks/EbookLibraryView.tsx`)
- Create ebook card component (`src/components/ebooks/EbookCard.tsx`)
- Create import modal (`src/components/ebooks/EbookImportModal.tsx`)
- Add "Ebooks" navigation item to sidebar
- Add `/ebooks` route

**Test**: Import PDF and EPUB, view in library, search/filter

### Phase 3: Basic Reader (Weeks 3-4)
**Goal**: Users can read PDF and EPUB files

- Create Reader page (`src/pages/Reader.tsx`)
- Create reader state store (`src/store/reader.ts`)
- Create main reader component (`src/components/reader/EbookReader.tsx`)
- Implement PDF reader (`src/components/reader/PDFReader.tsx`)
- Implement EPUB reader (`src/components/reader/EPUBReader.tsx`)
- Create basic controls (`src/components/reader/ReaderControls.tsx`)
- Implement page navigation
- Add `/reader/:id` route

**Test**: Open and read PDF (navigate pages), open and read EPUB (navigate sections)

### Phase 4: Reader Features (Week 5)
**Goal**: Customizable reading experience

- Create settings panel (`src/components/reader/ReaderSettings.tsx`)
- Implement font/theme customization
- Create table of contents component (`src/components/reader/TableOfContents.tsx`)
- Implement reading progress auto-save
- Create top bar (`src/components/reader/ReaderTopBar.tsx`)
- Implement fullscreen mode with auto-hide controls

**Test**: Change fonts and themes, navigate TOC, resume reading at saved position, toggle fullscreen

### Phase 5: Annotations & Bookmarks (Week 6)
**Goal**: Users can annotate and bookmark

- Create bookmark panel (`src/components/reader/BookmarkPanel.tsx`)
- Implement bookmark creation and navigation
- Create annotation tools (`src/components/reader/AnnotationTools.tsx`)
- Create annotation panel (`src/components/reader/AnnotationPanel.tsx`)
- Implement text highlighting (EPUB and PDF)
- Implement note-taking

**Test**: Add bookmarks and navigate to them, highlight text, add notes

### Phase 6: TTS Integration (Weeks 7-8)
**Goal**: Real-time text-to-speech with highlighting

- Create TTS reader store (`src/store/ttsReader.ts`)
- Create TTS controls (`src/components/reader/TTSControls.tsx`)
- Create sentence highlighter (`src/components/reader/SentenceHighlighter.tsx`)
- Implement sentence splitting and queue-based generation
- Implement synchronized text highlighting
- Implement TTS session persistence

**Test**: Read aloud PDF and EPUB, change voice/speed, verify highlighting sync

### Phase 7: Advanced Features (Week 9)
**Goal**: Search and statistics

- Create search panel (`src/components/reader/SearchPanel.tsx`)
- Implement in-book search (EPUB and PDF)
- Add reading statistics tracking
- Implement annotation export

**Test**: Search text in books, view reading stats

### Phase 8: Polish & Optimization (Week 10)
**Goal**: Production-ready quality

- Optimize PDF rendering (page caching, virtual scrolling)
- Optimize EPUB rendering (section preloading)
- Add keyboard shortcuts (arrows, F, Ctrl+F, etc.)
- Improve mobile responsiveness
- Add loading states and error handling
- Add accessibility features (ARIA labels)

**Test**: Large PDF (500+ pages), complex EPUB with images, mobile view

---

## Critical Files for Reference

Before implementation, read these files to understand existing patterns:

1. **src/store/audio.ts** - State management pattern
2. **src/components/layout/Layout.tsx** - Main layout structure
3. **src/pages/Player.tsx** - Complex page component example
4. **src/components/library/LibraryView.tsx** - Library view pattern
5. **src-tauri/src/document/mod.rs** - Existing document processing
6. **src/types/audiobook.ts** - Type definition patterns
7. **src-tauri/src/database/repository.rs** - Database CRUD patterns
8. **src/services/ttsService.ts** - TTS API integration

---

## Key Technical Details

### CFI Handling (EPUB)
```typescript
// Save position
rendition.on('relocated', (location) => {
  saveProgress({ currentCfi: location.start.cfi });
});

// Resume reading
await rendition.display(savedCFI);
```

### PDF Memory Optimization
```typescript
// Virtual scrolling - only render visible pages
const visiblePages = [currentPage - 1, currentPage, currentPage + 1];

// LRU cache for rendered pages (max 10)
class PageCache {
  private cache = new Map<number, HTMLCanvasElement>();
  private maxSize = 10;
}
```

### TTS Streaming
```typescript
// Generate first 3 sentences immediately
for (let i = 0; i < 3; i++) {
  await generateAndEnqueue(sentences[i]);
}

// Play first while generating rest
playNext();

// Background generation
for (let i = 3; i < sentences.length; i++) {
  await generateAndEnqueue(sentences[i]);
}
```

---

## Success Criteria

- ✅ Import PDF and EPUB files into separate ebook library
- ✅ Read ebooks with elegant, customizable interface
- ✅ Fullscreen reading mode with auto-hide controls
- ✅ Real-time TTS with synchronized text highlighting
- ✅ Bookmarks and annotations persist across sessions
- ✅ Reading progress auto-saves and resumes correctly
- ✅ Smooth performance with large files (500+ page PDFs)
- ✅ Responsive design works on different screen sizes
