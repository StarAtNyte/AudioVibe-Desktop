-- Create playback states table for persistence
CREATE TABLE IF NOT EXISTS playback_states (
    audiobook_id TEXT PRIMARY KEY NOT NULL,
    state_data TEXT NOT NULL,
    created_at DATETIME DEFAULT (datetime('now')) NOT NULL,
    updated_at DATETIME DEFAULT (datetime('now')) NOT NULL,
    FOREIGN KEY (audiobook_id) REFERENCES audiobooks (id) ON DELETE CASCADE
);

-- Create index on updated_at for cleanup operations
CREATE INDEX IF NOT EXISTS idx_playback_states_updated_at ON playback_states(updated_at);