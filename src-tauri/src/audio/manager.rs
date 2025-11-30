// Audio Manager for proper queue support and track switching
use super::{AudioEngine, PlaybackStatus};
use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use anyhow::Result;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Track {
    pub id: String,
    pub file_path: String,
    pub title: Option<String>,
    pub duration: Option<u64>,
}

pub struct AudioManager {
    engine: AudioEngine,
    current_track: Arc<Mutex<Option<Track>>>,
    queue: Arc<Mutex<VecDeque<Track>>>,
    #[allow(dead_code)]
    repeat_mode: Arc<Mutex<RepeatMode>>,
    #[allow(dead_code)]
    shuffle_enabled: Arc<Mutex<bool>>,
}

#[derive(Debug, Clone, PartialEq)]
#[allow(dead_code)]
pub enum RepeatMode {
    None,
    Track,
    Queue,
}

impl AudioManager {
    pub fn new() -> Result<Self> {
        let engine = AudioEngine::new()?;
        
        Ok(Self {
            engine,
            current_track: Arc::new(Mutex::new(None)),
            queue: Arc::new(Mutex::new(VecDeque::new())),
            repeat_mode: Arc::new(Mutex::new(RepeatMode::None)),
            shuffle_enabled: Arc::new(Mutex::new(false)),
        })
    }

    /// Load and play a single track immediately, clearing any queue
    pub fn play_track_immediately(&self, track: Track) -> Result<()> {
        log::info!("🎵 MANAGER: Loading track immediately: {}", track.file_path);
        
        // Load the new track (this will automatically stop previous audio)
        self.engine.load_file(&track.file_path)?;
        
        // Update current track
        {
            let mut current = self.current_track.lock().unwrap();
            *current = Some(track);
        }
        
        // Clear the queue since we're playing immediately
        {
            let mut queue = self.queue.lock().unwrap();
            queue.clear();
        }
        
        log::info!("🎵 MANAGER: Track loaded successfully, ready to play");
        Ok(())
    }

    /// Play the currently loaded track
    pub fn play(&self) -> Result<()> {
        log::info!("🎵 MANAGER: Starting playback");

        // Try to play - no automatic reload on failure
        // Reloading resets timing state which causes position to get stuck at 0:00
        self.engine.play()
    }

    /// Pause the current track
    pub fn pause(&self) {
        log::info!("🎵 MANAGER: Pausing playback");
        self.engine.pause();
    }

    /// Stop the current track
    pub fn stop(&self) {
        log::info!("🎵 MANAGER: Stopping playback");
        self.engine.stop();
    }

    /// Add a track to the end of the queue
    pub fn add_to_queue(&self, track: Track) {
        log::info!("🎵 MANAGER: Adding track to queue: {}", track.file_path);
        let mut queue = self.queue.lock().unwrap();
        queue.push_back(track);
    }

    /// Add multiple tracks to the queue
    #[allow(dead_code)]
    pub fn add_tracks_to_queue(&self, tracks: Vec<Track>) {
        log::info!("🎵 MANAGER: Adding {} tracks to queue", tracks.len());
        let mut queue = self.queue.lock().unwrap();
        for track in tracks {
            queue.push_back(track);
        }
    }

    /// Play the next track in the queue
    pub fn play_next(&self) -> Result<bool> {
        let next_track = {
            let mut queue = self.queue.lock().unwrap();
            queue.pop_front()
        };

        if let Some(track) = next_track {
            log::info!("🎵 MANAGER: Playing next track from queue: {}", track.file_path);
            self.play_track_immediately(track)?;
            Ok(true)
        } else {
            log::info!("🎵 MANAGER: No more tracks in queue");
            Ok(false)
        }
    }

    /// Play the previous track (if repeat mode allows)
    #[allow(dead_code)]
    pub fn play_previous(&self) -> Result<bool> {
        // For now, just restart current track
        // TODO: Implement previous track history
        self.seek(0.0)?;
        Ok(true)
    }

    /// Get the current playback status
    pub fn get_status(&self) -> PlaybackStatus {
        self.engine.get_status()
    }

    /// Get the current track
    #[allow(dead_code)]
    pub fn get_current_track(&self) -> Option<Track> {
        let current = self.current_track.lock().unwrap();
        current.clone()
    }

    /// Get the current queue
    pub fn get_queue(&self) -> Vec<Track> {
        let queue = self.queue.lock().unwrap();
        queue.iter().cloned().collect()
    }

    /// Clear the queue
    pub fn clear_queue(&self) {
        log::info!("🎵 MANAGER: Clearing queue");
        let mut queue = self.queue.lock().unwrap();
        queue.clear();
    }

    /// Seek to a position in the current track
    pub fn seek(&self, position_seconds: f32) -> Result<()> {
        log::info!("🎵 MANAGER: Seeking to position: {}", position_seconds);
        self.engine.seek(position_seconds)
    }

    /// Set volume (0.0 to 1.0)
    pub fn set_volume(&self, volume: f32) {
        log::info!("🎵 MANAGER: Setting volume to: {}", volume);
        self.engine.set_volume(volume);
    }

    /// Set playback speed
    pub fn set_speed(&self, speed: f32) {
        log::info!("🎵 MANAGER: Setting speed to: {}", speed);
        self.engine.set_speed(speed);
    }

    /// Set repeat mode
    #[allow(dead_code)]
    pub fn set_repeat_mode(&self, mode: RepeatMode) {
        log::info!("🎵 MANAGER: Setting repeat mode to: {:?}", mode);
        let mut repeat = self.repeat_mode.lock().unwrap();
        *repeat = mode;
    }

    /// Toggle shuffle
    #[allow(dead_code)]
    pub fn set_shuffle(&self, enabled: bool) {
        log::info!("🎵 MANAGER: Setting shuffle to: {}", enabled);
        let mut shuffle = self.shuffle_enabled.lock().unwrap();
        *shuffle = enabled;
    }
}