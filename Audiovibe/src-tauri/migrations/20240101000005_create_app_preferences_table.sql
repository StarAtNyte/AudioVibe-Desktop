-- Create app preferences table
CREATE TABLE IF NOT EXISTS app_preferences (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    created_at DATETIME DEFAULT (datetime('now')) NOT NULL,
    updated_at DATETIME DEFAULT (datetime('now')) NOT NULL
);