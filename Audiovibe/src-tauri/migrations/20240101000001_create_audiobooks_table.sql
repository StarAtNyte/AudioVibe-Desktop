-- Create audiobooks table
CREATE TABLE audiobooks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT,
    narrator TEXT,
    duration INTEGER, -- Duration in seconds
    file_path TEXT NOT NULL,
    cover_image_path TEXT,
    description TEXT,
    genre TEXT,
    publish_date TEXT,
    added_date TEXT NOT NULL,
    file_size INTEGER,
    bitrate INTEGER,
    sample_rate INTEGER,
    chapters_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Create index on commonly queried fields
CREATE INDEX idx_audiobooks_title ON audiobooks(title);
CREATE INDEX idx_audiobooks_author ON audiobooks(author);
CREATE INDEX idx_audiobooks_genre ON audiobooks(genre);
CREATE INDEX idx_audiobooks_added_date ON audiobooks(added_date);