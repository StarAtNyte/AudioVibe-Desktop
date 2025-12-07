-- Create ebooks table (separate from audiobooks)
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
    genre TEXT,
    added_date TEXT NOT NULL,
    modified_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Create reading progress tracking table
CREATE TABLE reading_progress (
    id TEXT PRIMARY KEY,
    ebook_id TEXT NOT NULL,
    current_page INTEGER, -- for PDF
    current_cfi TEXT, -- for EPUB (Canonical Fragment Identifier)
    current_chapter_href TEXT, -- fallback for EPUB
    percentage_complete REAL DEFAULT 0.0,
    reading_time_seconds INTEGER DEFAULT 0,
    last_read_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (ebook_id) REFERENCES ebooks(id) ON DELETE CASCADE
);

-- Create bookmarks table
CREATE TABLE ebook_bookmarks (
    id TEXT PRIMARY KEY,
    ebook_id TEXT NOT NULL,
    page_number INTEGER, -- for PDF
    cfi TEXT, -- for EPUB
    chapter_title TEXT,
    note TEXT,
    created_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (ebook_id) REFERENCES ebooks(id) ON DELETE CASCADE
);

-- Create annotations table (highlights and notes)
CREATE TABLE ebook_annotations (
    id TEXT PRIMARY KEY,
    ebook_id TEXT NOT NULL,
    annotation_type TEXT NOT NULL, -- 'highlight', 'underline', 'note'
    color TEXT, -- for highlights (yellow, green, blue, pink)
    cfi_range TEXT, -- EPUB selection range
    position_data TEXT, -- JSON for PDF coordinates
    selected_text TEXT,
    note TEXT,
    created_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (ebook_id) REFERENCES ebooks(id) ON DELETE CASCADE
);

-- Create per-book reader settings table
CREATE TABLE ebook_reader_settings (
    ebook_id TEXT PRIMARY KEY,
    font_family TEXT DEFAULT 'serif',
    font_size INTEGER DEFAULT 18,
    line_height REAL DEFAULT 1.6,
    letter_spacing REAL DEFAULT 0.0,
    text_align TEXT DEFAULT 'left',
    theme TEXT DEFAULT 'light', -- 'light', 'dark', 'sepia', 'custom'
    background_color TEXT,
    text_color TEXT,
    flow_mode TEXT DEFAULT 'paginated', -- 'paginated' or 'scrolled'
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (ebook_id) REFERENCES ebooks(id) ON DELETE CASCADE
);

-- Create indexes for commonly queried fields
CREATE INDEX idx_ebooks_title ON ebooks(title);
CREATE INDEX idx_ebooks_author ON ebooks(author);
CREATE INDEX idx_ebooks_genre ON ebooks(genre);
CREATE INDEX idx_ebooks_added_date ON ebooks(added_date);
CREATE INDEX idx_ebooks_format ON ebooks(file_format);

CREATE INDEX idx_reading_progress_ebook ON reading_progress(ebook_id);
CREATE INDEX idx_bookmarks_ebook ON ebook_bookmarks(ebook_id);
CREATE INDEX idx_annotations_ebook ON ebook_annotations(ebook_id);
