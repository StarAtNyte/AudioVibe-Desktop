-- Create listening history table
CREATE TABLE IF NOT EXISTS listening_history (
    id TEXT PRIMARY KEY,
    audiobook_id TEXT NOT NULL,
    listened_at TEXT NOT NULL,
    position_seconds INTEGER NOT NULL DEFAULT 0,
    duration_seconds INTEGER,
    completion_percentage REAL NOT NULL DEFAULT 0.0,
    session_duration INTEGER NOT NULL DEFAULT 0,
    playback_speed REAL NOT NULL DEFAULT 1.0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (audiobook_id) REFERENCES audiobooks (id) ON DELETE CASCADE
);

-- Create user preferences table  
CREATE TABLE IF NOT EXISTS user_preferences (
    id TEXT PRIMARY KEY,
    preference_type TEXT NOT NULL, -- 'genre', 'author', 'narrator', 'duration_range', etc.
    preference_value TEXT NOT NULL,
    preference_score REAL NOT NULL DEFAULT 1.0, -- Higher score = stronger preference
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Create recommendations table
CREATE TABLE IF NOT EXISTS recommendations (
    id TEXT PRIMARY KEY,
    audiobook_id TEXT NOT NULL,
    recommendation_type TEXT NOT NULL, -- 'similar_genre', 'same_author', 'collaborative', 'trending', etc.
    recommendation_score REAL NOT NULL DEFAULT 0.0,
    recommendation_reason TEXT, -- Human-readable explanation
    generated_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT,
    is_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
    user_feedback INTEGER DEFAULT NULL, -- -1 = dislike, 0 = neutral, 1 = like
    FOREIGN KEY (audiobook_id) REFERENCES audiobooks (id) ON DELETE CASCADE
);

-- Create recommendation feedback table
CREATE TABLE IF NOT EXISTS recommendation_feedback (
    id TEXT PRIMARY KEY,
    recommendation_id TEXT NOT NULL,
    feedback_type TEXT NOT NULL, -- 'like', 'dislike', 'not_interested', 'already_read', etc.
    feedback_value INTEGER NOT NULL, -- -1, 0, 1
    feedback_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (recommendation_id) REFERENCES recommendations (id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_listening_history_audiobook_id ON listening_history (audiobook_id);
CREATE INDEX IF NOT EXISTS idx_listening_history_listened_at ON listening_history (listened_at);
CREATE INDEX IF NOT EXISTS idx_listening_history_completion ON listening_history (completion_percentage);

CREATE INDEX IF NOT EXISTS idx_user_preferences_type ON user_preferences (preference_type);
CREATE INDEX IF NOT EXISTS idx_user_preferences_score ON user_preferences (preference_score DESC);

CREATE INDEX IF NOT EXISTS idx_recommendations_audiobook_id ON recommendations (audiobook_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_type ON recommendations (recommendation_type);
CREATE INDEX IF NOT EXISTS idx_recommendations_score ON recommendations (recommendation_score DESC);
CREATE INDEX IF NOT EXISTS idx_recommendations_generated_at ON recommendations (generated_at);

CREATE INDEX IF NOT EXISTS idx_recommendation_feedback_recommendation_id ON recommendation_feedback (recommendation_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_feedback_type ON recommendation_feedback (feedback_type);