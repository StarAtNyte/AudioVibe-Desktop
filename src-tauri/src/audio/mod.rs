// Audio engine module for AudioVibe
// This module will handle audio playback, metadata extraction, and audio processing

use rodio::{Decoder, OutputStream, Sink, Source, OutputStreamBuilder};
use std::fs::File;
use std::path::Path;
use std::sync::{Arc, Mutex};
use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};

pub mod player;
pub mod manager;
pub mod metadata;

pub use manager::*;
pub use metadata::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PlaybackState {
    Stopped,
    Playing,
    Paused,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioInfo {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub duration: Option<u64>, // Duration in seconds
    pub file_size: u64,
    pub sample_rate: Option<u32>,
    pub channels: Option<u16>,
    pub bitrate: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaybackStatus {
    pub state: PlaybackState,
    pub position: u64, // Position in seconds
    pub duration: Option<u64>, // Duration in seconds
    pub volume: f32,
    pub speed: f32,
    pub current_file: Option<String>,
}

pub struct AudioEngine {
    _stream: OutputStream,
    sink: Arc<Mutex<Sink>>,
    current_file: Arc<Mutex<Option<String>>>,
    current_audio_info: Arc<Mutex<Option<AudioInfo>>>,
    state: Arc<Mutex<PlaybackState>>,
    volume: Arc<Mutex<f32>>,
    speed: Arc<Mutex<f32>>,
    start_time: Arc<Mutex<Option<std::time::Instant>>>,
    pause_time: Arc<Mutex<Option<std::time::Instant>>>,
    paused_duration: Arc<Mutex<std::time::Duration>>,
    seek_offset: Arc<Mutex<u64>>, // Offset from seeking
    last_speed_change: Arc<Mutex<Option<std::time::Instant>>>,
    speed_adjusted_duration: Arc<Mutex<std::time::Duration>>, // Duration adjusted for previous speeds
}

impl AudioEngine {
    pub fn new() -> Result<Self> {
        // Use the new Rodio 0.21 API
        let mut stream = OutputStreamBuilder::open_default_stream()
            .context("Failed to create audio output stream")?;

        // Disable logging on drop to avoid cluttering output
        stream.log_on_drop(false);

        let sink = Sink::connect_new(stream.mixer());

        Ok(Self {
            _stream: stream,
            sink: Arc::new(Mutex::new(sink)),
            current_file: Arc::new(Mutex::new(None)),
            current_audio_info: Arc::new(Mutex::new(None)),
            state: Arc::new(Mutex::new(PlaybackState::Stopped)),
            volume: Arc::new(Mutex::new(1.0)),
            speed: Arc::new(Mutex::new(1.0)),
            start_time: Arc::new(Mutex::new(None)),
            pause_time: Arc::new(Mutex::new(None)),
            paused_duration: Arc::new(Mutex::new(std::time::Duration::ZERO)),
            seek_offset: Arc::new(Mutex::new(0)),
            last_speed_change: Arc::new(Mutex::new(None)),
            speed_adjusted_duration: Arc::new(Mutex::new(std::time::Duration::ZERO)),
        })
    }

    pub fn load_file<P: AsRef<Path>>(&self, path: P) -> Result<()> {
        let path = path.as_ref();
        println!("🔧 ENGINE: Starting load_file for: {}", path.display());

        // Forcefully stop and drain all audio from the sink
        {
            let sink = self.sink.lock().unwrap();
            println!("🔧 ENGINE: Stopping sink, currently empty: {}", sink.empty());
            sink.stop();

            // Wait for sink to be empty and fully drained
            let mut cleared_count = 0;
            while !sink.empty() {
                sink.skip_one();
                cleared_count += 1;
            }
            println!("🔧 ENGINE: Cleared {} items from sink", cleared_count);

            // Additional drain to ensure complete stop and resource cleanup
            std::thread::sleep(std::time::Duration::from_millis(100)); // Increased from 50ms
            println!("🔧 ENGINE: Sink fully drained");
        }

        // Extract metadata in parallel if possible (but don't block loading)
        let audio_info = extract_audio_metadata(path).unwrap_or_else(|e| {
            log::warn!("Failed to extract metadata, using defaults: {}", e);
            AudioInfo {
                title: None,
                artist: None,
                album: None,
                duration: None,
                file_size: 0,
                sample_rate: None,
                channels: None,
                bitrate: None,
            }
        });

        // Load the file and decoder OUTSIDE the sink lock to avoid deadlocks
        let file = File::open(path)
            .with_context(|| format!("Failed to open audio file: {}", path.display()))?;

        println!("🔧 ENGINE: Attempting to decode file with Rodio Decoder (seekable mode)");

        // Use Decoder::try_from for seekable sources in Rodio 0.21
        // This properly supports M4B files with seeking capability
        let source = match Decoder::try_from(file) {
            Ok(decoder) => {
                println!("🔧 ENGINE: Successfully created decoder with seeking support");
                decoder
            }
            Err(e) => {
                eprintln!("❌ ENGINE: Failed to create decoder: {:?}", e);
                eprintln!("❌ ENGINE: File path: {}", path.display());
                eprintln!("❌ ENGINE: File extension: {:?}", path.extension());

                return Err(anyhow::anyhow!("Failed to decode audio file '{}': {:?}", path.display(), e));
            }
        };

        {
            let sink = self.sink.lock().unwrap();
            println!("🔧 ENGINE: Appending source to sink");
            sink.append(source);
            println!("🔧 ENGINE: After append, sink empty: {}", sink.empty());
        }

        // Wait for sink to have content - check WITHOUT holding the lock for too long
        // Optimized for M4B files: shorter delays, more aggressive checking
        let mut attempts = 0;
        let max_attempts = 100; // More attempts but with shorter delays
        loop {
            {
                let sink = self.sink.lock().unwrap();
                if !sink.empty() {
                    println!("🔧 ENGINE: Sink loaded with content after {} attempts ({} ms)",
                             attempts, attempts * 5);
                    break;
                }
            }

            if attempts >= max_attempts {
                println!("❌ ENGINE: Sink still empty after {} attempts, file may be corrupted or unsupported", attempts);
                return Err(anyhow::anyhow!("Failed to load audio into sink after {} attempts. File path: {}", attempts, path.display()));
            }

            // Shorter, consistent delay for faster loading feedback
            std::thread::sleep(std::time::Duration::from_millis(5));
            attempts += 1;

            // Log progress every 20 attempts (every 100ms)
            if attempts % 20 == 0 {
                println!("🔧 ENGINE: Still waiting for sink to load... attempt {}/{} (~{}ms)",
                         attempts, max_attempts, attempts * 5);
            }
        }
        
        // Update all state at once
        {
            let mut current_file = self.current_file.lock().unwrap();
            *current_file = Some(path.to_string_lossy().to_string());
            
            let mut current_audio_info = self.current_audio_info.lock().unwrap();
            *current_audio_info = Some(audio_info);
            
            let mut state = self.state.lock().unwrap();
            *state = PlaybackState::Stopped;
            
            // Reset timing for new file
            let mut start_time = self.start_time.lock().unwrap();
            *start_time = None;
            let mut pause_time = self.pause_time.lock().unwrap();
            *pause_time = None;
            let mut paused_duration = self.paused_duration.lock().unwrap();
            *paused_duration = std::time::Duration::ZERO;
            let mut seek_offset = self.seek_offset.lock().unwrap();
            *seek_offset = 0;
            let mut last_speed_change = self.last_speed_change.lock().unwrap();
            *last_speed_change = None;
            let mut speed_adjusted_duration = self.speed_adjusted_duration.lock().unwrap();
            *speed_adjusted_duration = std::time::Duration::ZERO;
        }
        
        println!("🔧 ENGINE: Load complete, sink has content confirmed");
        log::info!("Loaded audio file: {}", path.display());
        Ok(())
    }

    pub fn play(&self) -> Result<()> {
        log::info!("🟢 PLAY: Starting audio playback");
        
        // Check if sink has content, with retry logic
        {
            let sink = self.sink.lock().unwrap();
            if sink.empty() {
                log::warn!("🟢 PLAY: No audio file loaded in sink, will retry");
                // Release the lock and wait, then try again
                drop(sink);
                std::thread::sleep(std::time::Duration::from_millis(25));
                let sink = self.sink.lock().unwrap();
                if sink.empty() {
                    log::warn!("🟢 PLAY: Still no audio file loaded after retry, delegating to manager");
                    return Err(anyhow::anyhow!("No audio file loaded"));
                }
                log::info!("🟢 PLAY: Audio found after retry");
            }
        }
        
        // Start playback with a fresh lock
        {
            let sink = self.sink.lock().unwrap();
            log::info!("🟢 PLAY: Sink has audio, calling sink.play()");
            sink.play();
        }
        
        // Update timing
        let now = std::time::Instant::now();
        {
            let mut pause_time = self.pause_time.lock().unwrap();
            if let Some(paused_at) = *pause_time {
                // Resume from pause - add to paused duration
                let mut paused_duration = self.paused_duration.lock().unwrap();
                *paused_duration += now - paused_at;
                *pause_time = None;
            }
            
            // Set start time if not already set
            let mut start_time = self.start_time.lock().unwrap();
            if start_time.is_none() {
                *start_time = Some(now);
            }
        }
        
        let mut state = self.state.lock().unwrap();
        *state = PlaybackState::Playing;
        
        log::info!("🟢 PLAY: Audio playback started successfully");
        Ok(())
    }

    pub fn pause(&self) {
        let sink = self.sink.lock().unwrap();
        sink.pause();
        
        // Record pause time
        let mut pause_time = self.pause_time.lock().unwrap();
        *pause_time = Some(std::time::Instant::now());
        
        let mut state = self.state.lock().unwrap();
        *state = PlaybackState::Paused;
        
        log::info!("Paused audio playback");
    }

    pub fn stop(&self) {
        log::info!("🔴 STOP: Stopping audio engine");
        let sink = self.sink.lock().unwrap();
        log::info!("🔴 STOP: Got sink lock, calling sink.stop()");
        sink.stop();
        
        // Clear the sink queue to ensure no audio remains
        let mut cleared_count = 0;
        while !sink.empty() {
            sink.skip_one();
            cleared_count += 1;
        }
        log::info!("🔴 STOP: Cleared {} items from sink queue", cleared_count);
        
        // Reset timing
        {
            let mut start_time = self.start_time.lock().unwrap();
            *start_time = None;
            let mut pause_time = self.pause_time.lock().unwrap();
            *pause_time = None;
            let mut paused_duration = self.paused_duration.lock().unwrap();
            *paused_duration = std::time::Duration::ZERO;
            let mut seek_offset = self.seek_offset.lock().unwrap();
            *seek_offset = 0;
            let mut last_speed_change = self.last_speed_change.lock().unwrap();
            *last_speed_change = None;
            let mut speed_adjusted_duration = self.speed_adjusted_duration.lock().unwrap();
            *speed_adjusted_duration = std::time::Duration::ZERO;
        }
        
        let mut state = self.state.lock().unwrap();
        *state = PlaybackState::Stopped;
        
        log::info!("🔴 STOP: Audio engine stopped and cleared completely");
    }

    pub fn seek(&self, position_seconds: f32) -> Result<()> {
        let position_seconds = position_seconds.max(0.0);
        let current_file = {
            let file_lock = self.current_file.lock().unwrap();
            file_lock.clone()
        };

        if current_file.is_none() {
            return Err(anyhow::anyhow!("No audio file loaded to seek in"));
        }

        log::info!("🔧 SEEK: Attempting to seek to {}s", position_seconds);
        
        // Try native seeking first (rodio 0.19+ feature)
        {
            let sink = self.sink.lock().unwrap();
            let duration = std::time::Duration::from_secs_f32(position_seconds);
            
            match sink.try_seek(duration) {
                Ok(()) => {
                    // Native seek succeeded - update position tracking
                    let mut seek_offset = self.seek_offset.lock().unwrap();
                    *seek_offset = position_seconds as u64;
                    
                    // Reset timing tracking since we've seeked
                    let mut start_time = self.start_time.lock().unwrap();
                    *start_time = Some(std::time::Instant::now());
                    let mut pause_time = self.pause_time.lock().unwrap();
                    *pause_time = None;
                    let mut paused_duration = self.paused_duration.lock().unwrap();
                    *paused_duration = std::time::Duration::ZERO;
                    
                    log::info!("🔧 SEEK: Native seek successful to {}s", position_seconds);
                    return Ok(());
                },
                Err(rodio::source::SeekError::NotSupported { .. }) => {
                    log::warn!("🔧 SEEK: Native seek not supported for this format, falling back to file reload");
                    // Fall through to fallback method
                },
                Err(e) => {
                    log::warn!("🔧 SEEK: Native seek failed with error: {:?}, falling back to file reload", e);
                    // Fall through to fallback method
                }
            }
        }
        
        // Fallback: Use file reload method for formats that don't support native seeking
        self.seek_fallback(position_seconds)
    }

    fn seek_fallback(&self, position_seconds: f32) -> Result<()> {
        let position_seconds_u64 = position_seconds as u64;
        let current_file = {
            let file_lock = self.current_file.lock().unwrap();
            file_lock.clone()
        };

        if let Some(file_path) = current_file {
            let was_playing = {
                let state = self.state.lock().unwrap();
                matches!(*state, PlaybackState::Playing)
            };
            
            log::info!("🔧 SEEK FALLBACK: Reloading file from {}s position", position_seconds);
            
            // Stop current playback and clear sink properly
            {
                let sink = self.sink.lock().unwrap();
                sink.stop();
                
                // Clear the sink with proper synchronization
                let start_clear = std::time::Instant::now();
                while !sink.empty() && start_clear.elapsed() < std::time::Duration::from_secs(2) {
                    sink.skip_one();
                    std::thread::sleep(std::time::Duration::from_millis(10));
                }
                
                if !sink.empty() {
                    log::warn!("🔧 SEEK FALLBACK: Sink not fully cleared after timeout");
                    sink.stop();
                }
            }
            
            // Load file with seek position
            self.load_file_with_offset(&file_path, position_seconds_u64)?;
            
            // Wait for file to be properly loaded with timeout
            let load_start = std::time::Instant::now();
            let mut sink_has_content = false;
            
            while load_start.elapsed() < std::time::Duration::from_secs(3) {
                {
                    let sink = self.sink.lock().unwrap();
                    if !sink.empty() {
                        sink_has_content = true;
                        break;
                    }
                }
                std::thread::sleep(std::time::Duration::from_millis(20));
            }
            
            if !sink_has_content {
                log::error!("🔧 SEEK FALLBACK: Failed to load audio content after seek");
                return Err(anyhow::anyhow!("Failed to load audio content after seek"));
            }
            
            // Resume playing if it was playing before
            if was_playing {
                let sink = self.sink.lock().unwrap();
                if !sink.empty() {
                    sink.play();
                    let mut state = self.state.lock().unwrap();
                    *state = PlaybackState::Playing;
                    log::info!("🔧 SEEK FALLBACK: Resumed playback after seek");
                } else {
                    log::warn!("🔧 SEEK FALLBACK: Cannot resume - sink is still empty after loading");
                    let mut state = self.state.lock().unwrap();
                    *state = PlaybackState::Stopped;
                    return Err(anyhow::anyhow!("Sink empty after loading, cannot resume playback"));
                }
            }
            
            log::info!("🔧 SEEK FALLBACK: Successfully seeked to {}s using file reload", position_seconds);
            Ok(())
        } else {
            Err(anyhow::anyhow!("No audio file loaded to seek in"))
        }
    }

    fn load_file_with_offset<P: AsRef<Path>>(&self, path: P, offset_seconds: u64) -> Result<()> {
        let path = path.as_ref();
        log::info!("🔧 ENGINE: Loading file with {}s offset: {}", offset_seconds, path.display());

        let file = File::open(path)
            .with_context(|| format!("Failed to open audio file: {}", path.display()))?;

        // Use Decoder::try_from for seekable sources (Rodio 0.21)
        let decoder = Decoder::try_from(file)
            .with_context(|| format!("Failed to decode audio file: {}", path.display()))?;

        let sink = self.sink.lock().unwrap();

        // Skip samples to reach the desired position using rodio's skip_duration
        if offset_seconds > 0 {
            let source_with_skip = decoder.skip_duration(std::time::Duration::from_secs(offset_seconds));
            sink.append(source_with_skip);
        } else {
            sink.append(decoder);
        }

        // Update seek offset and reset timing
        let mut seek_offset = self.seek_offset.lock().unwrap();
        *seek_offset = offset_seconds;

        let mut start_time = self.start_time.lock().unwrap();
        *start_time = Some(std::time::Instant::now());
        let mut pause_time = self.pause_time.lock().unwrap();
        *pause_time = None;
        let mut paused_duration = self.paused_duration.lock().unwrap();
        *paused_duration = std::time::Duration::ZERO;
        let mut last_speed_change = self.last_speed_change.lock().unwrap();
        *last_speed_change = None;
        let mut speed_adjusted_duration = self.speed_adjusted_duration.lock().unwrap();
        *speed_adjusted_duration = std::time::Duration::ZERO;

        Ok(())
    }


    pub fn set_volume(&self, volume: f32) {
        let sink = self.sink.lock().unwrap();
        let clamped_volume = volume.clamp(0.0, 1.0);
        sink.set_volume(clamped_volume);
        
        let mut vol = self.volume.lock().unwrap();
        *vol = clamped_volume;
        
        log::debug!("Set volume to: {}", clamped_volume);
    }

    pub fn get_volume(&self) -> f32 {
        let volume = self.volume.lock().unwrap();
        *volume
    }

    pub fn set_speed(&self, speed: f32) {
        let sink = self.sink.lock().unwrap();
        let clamped_speed = speed.clamp(0.25, 4.0);
        sink.set_speed(clamped_speed);
        
        let mut spd = self.speed.lock().unwrap();
        *spd = clamped_speed;
        
        log::debug!("Set playback speed to: {}x", clamped_speed);
    }

    pub fn get_speed(&self) -> f32 {
        let speed = self.speed.lock().unwrap();
        *speed
    }

    pub fn get_position(&self) -> u64 {
        let start_time = self.start_time.lock().unwrap();
        let pause_time = self.pause_time.lock().unwrap();
        let paused_duration = self.paused_duration.lock().unwrap();
        let seek_offset = self.seek_offset.lock().unwrap();
        let speed = self.get_speed();

        if let Some(started_at) = *start_time {
            let now = std::time::Instant::now();

            let elapsed = if let Some(paused_at) = *pause_time {
                // Currently paused - calculate time up to pause
                paused_at.duration_since(started_at)
            } else {
                // Currently playing - calculate total elapsed time
                now.duration_since(started_at)
            };

            // Subtract the time spent paused and multiply by speed
            let active_time = elapsed.saturating_sub(*paused_duration);
            let speed_adjusted_time = (active_time.as_secs_f32() * speed) as u64;

            // Round to avoid floating point precision issues that can cause stuck positions
            let position = *seek_offset + speed_adjusted_time;
            position
        } else {
            // When not started, always return the seek offset (could be 0 or a resumed position)
            *seek_offset
        }
    }

    pub fn get_status(&self) -> PlaybackStatus {
        let state = {
            let state_lock = self.state.lock().unwrap();
            state_lock.clone()
        };
        
        let current_file = {
            let file_lock = self.current_file.lock().unwrap();
            file_lock.clone()
        };
        
        let duration = {
            let audio_info_lock = self.current_audio_info.lock().unwrap();
            audio_info_lock.as_ref().and_then(|info| info.duration)
        };
        
        PlaybackStatus {
            state,
            position: self.get_position(),
            duration,
            volume: self.get_volume(),
            speed: self.get_speed(),
            current_file,
        }
    }

    pub fn get_audio_info<P: AsRef<Path>>(path: P) -> Result<AudioInfo> {
        extract_audio_metadata(path)
    }
}

impl Default for AudioEngine {
    fn default() -> Self {
        Self::new().expect("Failed to initialize default audio engine")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_audio_engine_creation() {
        let engine = AudioEngine::new();
        assert!(engine.is_ok());
    }

    #[test]
    fn test_audio_engine_volume_control() {
        let engine = AudioEngine::new().unwrap();
        
        // Test setting volume
        engine.set_volume(0.5);
        assert_eq!(engine.get_volume(), 0.5);
        
        // Test volume clamping
        engine.set_volume(1.5);
        assert_eq!(engine.get_volume(), 1.0);
        
        engine.set_volume(-0.5);
        assert_eq!(engine.get_volume(), 0.0);
    }

    #[test]
    fn test_audio_engine_speed_control() {
        let engine = AudioEngine::new().unwrap();
        
        // Test setting speed
        engine.set_speed(1.5);
        assert_eq!(engine.get_speed(), 1.5);
        
        // Test speed clamping
        engine.set_speed(5.0);
        assert_eq!(engine.get_speed(), 4.0);
        
        engine.set_speed(0.1);
        assert_eq!(engine.get_speed(), 0.25);
    }

    #[test]
    fn test_playback_status() {
        let engine = AudioEngine::new().unwrap();
        let status = engine.get_status();
        
        assert!(matches!(status.state, PlaybackState::Stopped));
        assert_eq!(status.volume, 1.0);
        assert_eq!(status.speed, 1.0);
        assert!(status.current_file.is_none());
    }
}