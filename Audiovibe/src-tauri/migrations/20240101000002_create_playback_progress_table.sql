-- Create playback_progress table
CREATE TABLE playback_progress (
    id TEXT PRIMARY KEY,
    audiobook_id TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0, -- Position in seconds
    duration INTEGER, -- Total duration in seconds
    chapter_index INTEGER DEFAULT 0,
    playback_speed REAL DEFAULT 1.0,
    last_played_at TEXT NOT NULL DEFAULT (datetime('now')),
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (audiobook_id) REFERENCES audiobooks (id) ON DELETE CASCADE
);

-- Create index for efficient lookups
CREATE INDEX idx_playback_progress_audiobook_id ON playback_progress(audiobook_id);
CREATE INDEX idx_playback_progress_last_played ON playback_progress(last_played_at);