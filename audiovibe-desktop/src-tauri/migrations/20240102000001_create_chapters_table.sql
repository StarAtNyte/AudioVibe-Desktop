-- Create chapters table for storing individual chapter information
CREATE TABLE chapters (
    id TEXT PRIMARY KEY,
    audiobook_id TEXT NOT NULL,
    chapter_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    file_path TEXT NOT NULL,
    duration INTEGER, -- Duration in seconds
    file_size INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    FOREIGN KEY (audiobook_id) REFERENCES audiobooks(id) ON DELETE CASCADE
);

-- Create indexes for efficient querying
CREATE INDEX idx_chapters_audiobook_id ON chapters(audiobook_id);
CREATE INDEX idx_chapters_number ON chapters(audiobook_id, chapter_number);

-- Create unique constraint to prevent duplicate chapter numbers per audiobook
CREATE UNIQUE INDEX idx_chapters_unique ON chapters(audiobook_id, chapter_number);