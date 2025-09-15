// Data models for AudioVibe application

use serde::{Deserialize, Serialize};
// use chrono::{DateTime, Utc}; // Will be used in future tasks

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Audiobook {
    pub id: i64,
    pub title: String,
    pub author: Option<String>,
    pub file_path: String,
    pub duration: Option<i64>,
    pub cover_image: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlaybackState {
    pub audiobook_id: i64,
    pub position: f64,
    pub playback_rate: f32,
    pub volume: f32,
    pub is_playing: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub version: String,
    pub initialized: bool,
    pub app_name: String,
    pub build_date: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SystemInfo {
    pub platform: String,
    pub arch: String,
    pub version: String,
    pub tauri_version: String,
}