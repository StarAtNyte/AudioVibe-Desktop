-- Create collections table
CREATE TABLE collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#3B82F6', -- Default blue color
    is_smart BOOLEAN DEFAULT FALSE,
    smart_criteria TEXT, -- JSON string for smart collection rules
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Create collection_audiobooks junction table for many-to-many relationship
CREATE TABLE collection_audiobooks (
    id TEXT PRIMARY KEY,
    collection_id TEXT NOT NULL,
    audiobook_id TEXT NOT NULL,
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (collection_id) REFERENCES collections (id) ON DELETE CASCADE,
    FOREIGN KEY (audiobook_id) REFERENCES audiobooks (id) ON DELETE CASCADE,
    UNIQUE (collection_id, audiobook_id)
);

-- Create indexes for efficient queries
CREATE INDEX idx_collections_name ON collections(name);
CREATE INDEX idx_collection_audiobooks_collection_id ON collection_audiobooks(collection_id);
CREATE INDEX idx_collection_audiobooks_audiobook_id ON collection_audiobooks(audiobook_id);