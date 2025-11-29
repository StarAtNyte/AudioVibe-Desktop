// Audiobook types matching Rust backend
export interface Audiobook {
  id: string;
  title: string;
  author?: string;
  narrator?: string;
  duration?: number; // Duration in seconds
  file_path: string;
  cover_image_path?: string;
  description?: string;
  genre?: string;
  publish_date?: string;
  added_date: string;
  file_size?: number;
  bitrate?: number;
  sample_rate?: number;
  chapters_count: number;
  created_at: string;
  updated_at: string;
}

// Chapter types for file-based audiobooks
export interface Chapter {
  id: string;
  audiobook_id: string;
  chapter_number: number;
  title: string;
  file_path: string;
  duration?: number; // Duration in seconds
  file_size?: number;
  created_at: string;
  updated_at: string;
}

// Enhanced chapter interface for UI components
export interface ChapterWithProgress {
  id: string;
  title: string;
  startTime: number; // Always 0 for file-based chapters
  endTime: number; // Duration of the file
  duration: number;
  file_path: string;
  chapter_number: number;
}

export interface PlaybackProgress {
  id: string;
  audiobook_id: string;
  position: number; // Position in seconds
  duration?: number; // Total duration in seconds
  chapter_index: number;
  playback_speed: number;
  last_played_at: string;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  color: string;
  is_smart: boolean;
  smart_criteria?: string;
  created_at: string;
  updated_at: string;
}

export interface AudioInfo {
  title?: string;
  artist?: string;
  album?: string;
  duration?: number; // Duration in seconds
  file_size: number;
  sample_rate?: number;
  channels?: number;
  bitrate?: number;
}

export interface PlaybackStatus {
  state: 'Stopped' | 'Playing' | 'Paused';
  position: number; // Position in seconds
  duration?: number; // Duration in seconds
  volume: number;
  speed: number;
  current_file?: string;
}

// DTOs for API communication
export interface CreateAudiobookDto {
  title: string;
  file_path: string;
  author?: string;
  narrator?: string;
  description?: string;
  genre?: string;
}

export interface UpdateAudiobookDto {
  title?: string;
  author?: string;
  narrator?: string;
  description?: string;
  genre?: string;
  cover_image_path?: string;
}

export interface UpdatePlaybackProgressDto {
  position: number;
  chapter_index?: number;
  playback_speed?: number;
  is_completed?: boolean;
}

export interface CreateCollectionDto {
  name: string;
  description?: string;
  color?: string;
}

// App and system types
export interface AppConfig {
  version: string;
  initialized: boolean;
  app_name: string;
  build_date: string;
}

export interface SystemInfo {
  platform: string;
  arch: string;
  version: string;
  tauri_version: string;
}