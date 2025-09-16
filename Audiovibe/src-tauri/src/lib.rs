mod models;
mod database;
mod audio;
mod filesystem;
mod services;
mod download;
mod document;

use models::{AppConfig, SystemInfo};
use database::{DatabaseManager, models::*, repository::*};
use audio::{AudioManager, AudioInfo, PlaybackStatus, Track};
use filesystem::{FileSystemScanner, AudioFileInfo};
use services::RecommendationService;
use download::DownloadManager;
use document::{DocumentProcessor, ProcessedDocument};
use std::env;
use std::sync::{mpsc, Mutex, OnceLock};
use std::thread;
use tauri::State;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust and AudioVibe!", name)
}

// Window control commands
#[tauri::command]
async fn minimize_window(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
async fn maximize_window(window: tauri::Window) -> Result<(), String> {
    window.maximize().map_err(|e| e.to_string())
}

#[tauri::command]
async fn close_window(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

// App state to hold database manager and download manager
struct AppState {
    db: Mutex<Option<DatabaseManager>>,
    download_manager: Mutex<Option<DownloadManager>>,
}

// Audio command messages for the dedicated audio thread
#[derive(Debug)]
enum AudioCommand {
    LoadFile { file_path: String, response: mpsc::Sender<Result<(), String>> },
    Play { response: mpsc::Sender<Result<(), String>> },
    Pause { response: mpsc::Sender<Result<(), String>> },
    Stop { response: mpsc::Sender<Result<(), String>> },
    SetVolume { volume: f32, response: mpsc::Sender<Result<(), String>> },
    SetSpeed { speed: f32, response: mpsc::Sender<Result<(), String>> },
    Seek { position: f32, response: mpsc::Sender<Result<(), String>> },
    GetStatus { response: mpsc::Sender<PlaybackStatus> },
    AddToQueue { track: Track, response: mpsc::Sender<Result<(), String>> },
    PlayNext { response: mpsc::Sender<Result<bool, String>> },
    ClearQueue { response: mpsc::Sender<Result<(), String>> },
    GetQueue { response: mpsc::Sender<Vec<Track>> },
}

// Global sender for audio commands
static AUDIO_SENDER: OnceLock<mpsc::Sender<AudioCommand>> = OnceLock::new();

// Initialize the audio thread and return the sender
fn init_audio_thread() -> mpsc::Sender<AudioCommand> {
    let (sender, receiver) = mpsc::channel::<AudioCommand>();
    
    thread::spawn(move || {
        println!("🎵 THREAD: Starting dedicated audio thread");
        let audio_manager = match AudioManager::new() {
            Ok(manager) => {
                println!("🎵 THREAD: Audio manager created successfully");
                manager
            }
            Err(e) => {
                eprintln!("❌ THREAD: Failed to create audio manager: {}", e);
                return;
            }
        };

        // Main audio thread loop
        for command in receiver {
            match command {
                AudioCommand::LoadFile { file_path, response } => {
                    println!("🎵 THREAD: Loading file: {}", file_path);
                    // Stop any existing audio first
                    audio_manager.stop();
                    
                    let track = Track {
                        id: uuid::Uuid::new_v4().to_string(),
                        file_path: file_path.clone(),
                        title: None,
                        duration: None,
                    };
                    
                    // Load the track and play it immediately as a single atomic operation
                    let result = audio_manager.play_track_immediately(track)
                        .and_then(|_| {
                            // Add a small delay to ensure loading is complete
                            std::thread::sleep(std::time::Duration::from_millis(10));
                            audio_manager.play()
                        })
                        .map_err(|e| e.to_string());
                    let _ = response.send(result);
                }
                AudioCommand::Play { response } => {
                    println!("🎵 THREAD: Playing");
                    let result = audio_manager.play().map_err(|e| e.to_string());
                    let _ = response.send(result);
                }
                AudioCommand::Pause { response } => {
                    println!("🎵 THREAD: Pausing");
                    audio_manager.pause();
                    let _ = response.send(Ok(()));
                }
                AudioCommand::Stop { response } => {
                    println!("🎵 THREAD: Stopping");
                    audio_manager.stop();
                    let _ = response.send(Ok(()));
                }
                AudioCommand::SetVolume { volume, response } => {
                    println!("🎵 THREAD: Setting volume: {}", volume);
                    audio_manager.set_volume(volume);
                    let _ = response.send(Ok(()));
                }
                AudioCommand::SetSpeed { speed, response } => {
                    println!("🎵 THREAD: Setting speed: {}", speed);
                    audio_manager.set_speed(speed);
                    let _ = response.send(Ok(()));
                }
                AudioCommand::Seek { position, response } => {
                    println!("🎵 THREAD: Seeking to: {}", position);
                    let result = audio_manager.seek(position).map_err(|e| e.to_string());
                    let _ = response.send(result);
                }
                AudioCommand::GetStatus { response } => {
                    let status = audio_manager.get_status();
                    let _ = response.send(status);
                }
                AudioCommand::AddToQueue { track, response } => {
                    println!("🎵 THREAD: Adding to queue: {}", track.file_path);
                    audio_manager.add_to_queue(track);
                    let _ = response.send(Ok(()));
                }
                AudioCommand::PlayNext { response } => {
                    println!("🎵 THREAD: Playing next");
                    let result = audio_manager.play_next().map_err(|e| e.to_string());
                    let _ = response.send(result);
                }
                AudioCommand::ClearQueue { response } => {
                    println!("🎵 THREAD: Clearing queue");
                    audio_manager.clear_queue();
                    let _ = response.send(Ok(()));
                }
                AudioCommand::GetQueue { response } => {
                    let queue = audio_manager.get_queue();
                    let _ = response.send(queue);
                }
            }
        }
        println!("🎵 THREAD: Audio thread ending");
    });
    
    sender
}

// Get the audio sender, initializing if necessary
fn get_audio_sender() -> &'static mpsc::Sender<AudioCommand> {
    AUDIO_SENDER.get_or_init(|| {
        println!("🎵 INIT: Initializing audio thread");
        init_audio_thread()
    })
}


#[tauri::command]
async fn initialize_app(state: State<'_, AppState>) -> Result<AppConfig, String> {
    // Initialize logging with proper level
    if env_logger::try_init().is_ok() {
        println!("🚀 Logger initialized successfully");
    }
    
    println!("🚀 INITIALIZING AUDIOVIBE APPLICATION");
    log::info!("Initializing AudioVibe application");

    println!("🚀 AUDIO: Using simplified single manager approach");

    // Initialize database
    let app_data_dir = std::env::current_dir()
        .map_err(|e| format!("Failed to get current directory: {}", e))?
        .join("data");
    
    tokio::fs::create_dir_all(&app_data_dir).await
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;
    
    let db_path = app_data_dir.join("audiovibe.db").to_string_lossy().to_string();
    let mut db_manager = DatabaseManager::new(db_path);
    
    db_manager.initialize().await
        .map_err(|e| format!("Failed to initialize database: {}", e))?;
    
    // Store database manager in app state
    let mut db_state = state.db.lock().unwrap();
    *db_state = Some(db_manager);
    
    log::info!("Database initialized successfully");
    
    // Initialize download manager
    let download_manager = DownloadManager::new()
        .map_err(|e| format!("Failed to initialize download manager: {}", e))?;
    
    let mut download_state = state.download_manager.lock().unwrap();
    *download_state = Some(download_manager);
    
    println!("✅ Download manager initialized successfully");
    log::info!("Download manager initialized successfully");

    Ok(AppConfig {
        version: env!("CARGO_PKG_VERSION").to_string(),
        initialized: true,
        app_name: "AudioVibe".to_string(),
        build_date: chrono::Utc::now().format("%Y-%m-%d").to_string(),
    })
}

#[tauri::command]
async fn get_system_info() -> Result<SystemInfo, String> {
    Ok(SystemInfo {
        platform: env::consts::OS.to_string(),
        arch: env::consts::ARCH.to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        tauri_version: "2.0".to_string(),
    })
}

// Database commands
#[tauri::command]
async fn create_audiobook(
    state: State<'_, AppState>,
    dto: CreateAudiobookDto,
) -> Result<Audiobook, String> {
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };
    
    let repo = AudiobookRepository::new(&pool);
    repo.create(dto).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_all_audiobooks(state: State<'_, AppState>) -> Result<Vec<Audiobook>, String> {
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };
    
    let repo = AudiobookRepository::new(&pool);
    repo.find_all().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_audiobook_by_id(
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<Audiobook>, String> {
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };
    
    let repo = AudiobookRepository::new(&pool);
    repo.find_by_id(&id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn search_audiobooks(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<Audiobook>, String> {
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };
    
    let repo = AudiobookRepository::new(&pool);
    repo.search(&query).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn search_audiobooks_with_filters(
    state: State<'_, AppState>,
    filters: SearchFilters,
) -> Result<Vec<Audiobook>, String> {
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };
    
    let repo = AudiobookRepository::new(&pool);
    repo.search_with_filters(filters).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_distinct_authors(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };
    
    let repo = AudiobookRepository::new(&pool);
    repo.get_distinct_authors().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_distinct_genres(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };
    
    let repo = AudiobookRepository::new(&pool);
    repo.get_distinct_genres().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_distinct_narrators(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };
    
    let repo = AudiobookRepository::new(&pool);
    repo.get_distinct_narrators().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_audiobook(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };
    
    let repo = AudiobookRepository::new(&pool);
    repo.delete(&id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_playback_progress(
    state: State<'_, AppState>,
    audiobook_id: String,
    dto: UpdatePlaybackProgressDto,
) -> Result<PlaybackProgress, String> {
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };
    
    let repo = PlaybackProgressRepository::new(&pool);
    repo.create_or_update(&audiobook_id, dto).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_playback_progress(
    state: State<'_, AppState>,
    audiobook_id: String,
) -> Result<Option<PlaybackProgress>, String> {
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };
    
    let repo = PlaybackProgressRepository::new(&pool);
    repo.find_by_audiobook_id(&audiobook_id).await.map_err(|e| e.to_string())
}


// Audio control commands
#[tauri::command]
async fn load_audio_file(state: State<'_, AppState>, file_path: String) -> Result<(), String> {
    println!("🎵 LOAD: Loading and playing audio file: {}", file_path);
    log::info!("🎵 LOAD: Loading audio file: {}", file_path);
    
    // First, verify the path exists
    let path_exists = std::path::Path::new(&file_path).exists();
    let is_file = std::path::Path::new(&file_path).is_file();
    let is_dir = std::path::Path::new(&file_path).is_dir();
    
    println!("🎵 LOAD: Path analysis - exists: {}, is_file: {}, is_dir: {}", path_exists, is_file, is_dir);
    
    if !path_exists {
        let error_msg = format!("File or directory does not exist: {}", file_path);
        println!("❌ LOAD: {}", error_msg);
        return Err(error_msg);
    }
    
    // Check if this is a LibriVox URL (contains archive.org and .zip) or a local LibriVox directory
    if file_path.contains("archive.org") && file_path.contains(".zip") {
        println!("🌐 LIBRIVOX: Detected LibriVox URL, using download system");
        
        // Get the download manager from app state
        let download_manager = {
            let dm_state = state.download_manager.lock().unwrap();
            match dm_state.as_ref() {
                Some(manager) => manager.clone(),
                None => return Err("Download manager not initialized".to_string()),
            }
        };
        
        // Download and extract the LibriVox ZIP file
        match download_manager.download_and_extract_zip(&file_path).await {
            Ok(result) => {
                println!("✅ LIBRIVOX: Download completed. Found {} audio files", result.extracted_files.len());
                
                if result.extracted_files.is_empty() {
                    return Err("No audio files found in the downloaded archive".to_string());
                }
                
                // Sort files to get consistent ordering (usually chapter order)
                let mut files = result.extracted_files;
                files.sort();
                
                // Use the first audio file
                let first_file = &files[0];
                let local_file_path = first_file.to_string_lossy().to_string();
                
                println!("🎵 LIBRIVOX: Using local file: {}", local_file_path);
                
                // Now load the local file using the standard audio system
                let sender = get_audio_sender();
                let (response_sender, response_receiver) = mpsc::channel();
                
                sender.send(AudioCommand::LoadFile { 
                    file_path: local_file_path, 
                    response: response_sender 
                }).map_err(|e| format!("Failed to send load command: {}", e))?;
                
                response_receiver.recv()
                    .map_err(|e| format!("Failed to receive response: {}", e))?
            }
            Err(e) => {
                println!("❌ LIBRIVOX: Download failed: {}", e);
                Err(format!("Failed to download LibriVox content: {}", e))
            }
        }
    } else if std::path::Path::new(&file_path).is_dir() {
        // Handle local LibriVox directory (files already downloaded)
        println!("📁 LIBRIVOX LOCAL: Detected local LibriVox directory: {}", file_path);
        
        use std::fs;
        
        // Find all audio files in the directory
        let mut audio_files = Vec::new();
        match fs::read_dir(&file_path) {
            Ok(entries) => {
                for entry in entries {
                    if let Ok(entry) = entry {
                        let path = entry.path();
                        if let Some(extension) = path.extension() {
                            let ext = extension.to_string_lossy().to_lowercase();
                            if matches!(ext.as_str(), "mp3" | "m4a" | "m4b" | "aac" | "flac" | "wav" | "ogg" | "opus" | "wma") {
                                audio_files.push(path);
                            }
                        }
                    }
                }
            }
            Err(e) => {
                println!("❌ LIBRIVOX LOCAL: Failed to read directory '{}': {}", file_path, e);
                return Err(format!("Failed to read LibriVox directory '{}': {}", file_path, e));
            }
        }
        
        // Sort files for consistent ordering (usually gives us proper chapter order)
        audio_files.sort();
        
        if audio_files.is_empty() {
            println!("❌ LIBRIVOX LOCAL: No audio files found in directory: {}", file_path);
            return Err(format!("No audio files found in LibriVox directory: {}", file_path));
        }
        
        // Play the first audio file
        let first_file = audio_files[0].to_string_lossy().to_string();
        println!("🎵 LIBRIVOX LOCAL: Playing first file: {}", first_file);
        println!("🎵 LIBRIVOX LOCAL: Found {} total audio files", audio_files.len());
        
        // Check if we need to create chapter records for this audiobook
        // We'll do this synchronously to avoid lifetime issues
        if audio_files.len() > 1 {
            println!("📁 CHAPTERS: Detected multi-file audiobook, will create chapters on next navigation");
        }
        
        let sender = get_audio_sender();
        let (response_sender, response_receiver) = mpsc::channel();
        
        sender.send(AudioCommand::LoadFile { 
            file_path: first_file, 
            response: response_sender 
        }).map_err(|e| format!("Failed to send load command: {}", e))?;
        
        response_receiver.recv()
            .map_err(|e| format!("Failed to receive response: {}", e))?
    } else {
        // Standard local file loading
        let sender = get_audio_sender();
        let (response_sender, response_receiver) = mpsc::channel();
        
        sender.send(AudioCommand::LoadFile { file_path, response: response_sender })
            .map_err(|e| format!("Failed to send load command: {}", e))?;
        
        response_receiver.recv()
            .map_err(|e| format!("Failed to receive response: {}", e))?
    }
}

#[tauri::command]
async fn play_audio() -> Result<(), String> {
    println!("🟢 PLAY: Starting play command");
    log::info!("🟢 PLAY: Starting play command");
    
    let sender = get_audio_sender();
    let (response_sender, response_receiver) = mpsc::channel();
    
    sender.send(AudioCommand::Play { response: response_sender })
        .map_err(|e| format!("Failed to send play command: {}", e))?;
    
    response_receiver.recv()
        .map_err(|e| format!("Failed to receive response: {}", e))?
}

#[tauri::command]
async fn pause_audio() -> Result<(), String> {
    println!("⏸️ PAUSE: Pausing audio");
    
    let sender = get_audio_sender();
    let (response_sender, response_receiver) = mpsc::channel();
    
    sender.send(AudioCommand::Pause { response: response_sender })
        .map_err(|e| format!("Failed to send pause command: {}", e))?;
    
    response_receiver.recv()
        .map_err(|e| format!("Failed to receive response: {}", e))?
}

#[tauri::command]
async fn stop_audio() -> Result<(), String> {
    println!("🛑 STOP: Stopping audio");
    
    let sender = get_audio_sender();
    let (response_sender, response_receiver) = mpsc::channel();
    
    sender.send(AudioCommand::Stop { response: response_sender })
        .map_err(|e| format!("Failed to send stop command: {}", e))?;
    
    response_receiver.recv()
        .map_err(|e| format!("Failed to receive response: {}", e))?
}

#[tauri::command]
async fn set_volume(volume: f32) -> Result<(), String> {
    println!("🔊 VOLUME: Setting volume: {}", volume);
    
    let sender = get_audio_sender();
    let (response_sender, response_receiver) = mpsc::channel();
    
    sender.send(AudioCommand::SetVolume { volume, response: response_sender })
        .map_err(|e| format!("Failed to send volume command: {}", e))?;
    
    response_receiver.recv()
        .map_err(|e| format!("Failed to receive response: {}", e))?
}

#[tauri::command]
async fn set_playback_speed(speed: f32) -> Result<(), String> {
    println!("⏩ SPEED: Setting speed: {}", speed);
    
    let sender = get_audio_sender();
    let (response_sender, response_receiver) = mpsc::channel();
    
    sender.send(AudioCommand::SetSpeed { speed, response: response_sender })
        .map_err(|e| format!("Failed to send speed command: {}", e))?;
    
    response_receiver.recv()
        .map_err(|e| format!("Failed to receive response: {}", e))?
}

#[tauri::command]
async fn get_playback_status() -> Result<PlaybackStatus, String> {
    println!("📊 STATUS: Getting playback status");
    
    let sender = get_audio_sender();
    let (response_sender, response_receiver) = mpsc::channel();
    
    sender.send(AudioCommand::GetStatus { response: response_sender })
        .map_err(|e| format!("Failed to send status command: {}", e))?;
    
    response_receiver.recv()
        .map_err(|e| format!("Failed to receive response: {}", e))
}

#[tauri::command]
async fn seek_audio(position_seconds: f32) -> Result<(), String> {
    println!("⏭️ SEEK: Seeking to position: {}", position_seconds);
    
    let sender = get_audio_sender();
    let (response_sender, response_receiver) = mpsc::channel();
    
    sender.send(AudioCommand::Seek { position: position_seconds, response: response_sender })
        .map_err(|e| format!("Failed to send seek command: {}", e))?;
    
    response_receiver.recv()
        .map_err(|e| format!("Failed to receive response: {}", e))?
}

// Queue management commands
#[tauri::command]
async fn add_to_queue(file_path: String, title: Option<String>) -> Result<(), String> {
    log::info!("🎵 QUEUE: Adding to queue: {}", file_path);
    
    let track = Track {
        id: uuid::Uuid::new_v4().to_string(),
        file_path,
        title,
        duration: None,
    };
    
    let sender = get_audio_sender();
    let (response_sender, response_receiver) = mpsc::channel();
    
    sender.send(AudioCommand::AddToQueue { track, response: response_sender })
        .map_err(|e| format!("Failed to send add to queue command: {}", e))?;
    
    response_receiver.recv()
        .map_err(|e| format!("Failed to receive response: {}", e))?
}

#[tauri::command]
async fn play_next() -> Result<bool, String> {
    log::info!("🎵 QUEUE: Playing next track");
    
    let sender = get_audio_sender();
    let (response_sender, response_receiver) = mpsc::channel();
    
    sender.send(AudioCommand::PlayNext { response: response_sender })
        .map_err(|e| format!("Failed to send play next command: {}", e))?;
    
    response_receiver.recv()
        .map_err(|e| format!("Failed to receive response: {}", e))?
}

#[tauri::command]
async fn clear_queue() -> Result<(), String> {
    log::info!("🎵 QUEUE: Clearing queue");
    
    let sender = get_audio_sender();
    let (response_sender, response_receiver) = mpsc::channel();
    
    sender.send(AudioCommand::ClearQueue { response: response_sender })
        .map_err(|e| format!("Failed to send clear queue command: {}", e))?;
    
    response_receiver.recv()
        .map_err(|e| format!("Failed to receive response: {}", e))?
}

#[tauri::command]
async fn get_queue() -> Result<Vec<Track>, String> {
    let sender = get_audio_sender();
    let (response_sender, response_receiver) = mpsc::channel();
    
    sender.send(AudioCommand::GetQueue { response: response_sender })
        .map_err(|e| format!("Failed to send get queue command: {}", e))?;
    
    response_receiver.recv()
        .map_err(|e| format!("Failed to receive response: {}", e))
}

// File system commands
#[tauri::command]
async fn scan_directory(directory_path: String) -> Result<Vec<AudioFileInfo>, String> {
    let scanner = FileSystemScanner::new();
    let path = std::path::Path::new(&directory_path);
    scanner.scan_directory(path)
}


#[tauri::command]
async fn get_file_info(file_path: String) -> Result<AudioFileInfo, String> {
    let scanner = FileSystemScanner::new();
    let path = std::path::Path::new(&file_path);
    Ok(scanner.get_audio_file_info(path))
}

#[tauri::command]
async fn import_audiobook_from_files(
    state: State<'_, AppState>,
    file_paths: Vec<String>
) -> Result<Audiobook, String> {
    let scanner = FileSystemScanner::new();
    let mut audio_files = Vec::new();
    
    // Get info for all files
    for path_str in file_paths {
        let path = std::path::Path::new(&path_str);
        let file_info = scanner.get_audio_file_info(path);
        if !file_info.is_valid {
            return Err(format!("Invalid audio file: {}", file_info.error_message.unwrap_or_default()));
        }
        audio_files.push(file_info);
    }

    if audio_files.is_empty() {
        return Err("No valid audio files provided".to_string());
    }

    // Use first file's metadata for audiobook info
    let first_file = &audio_files[0];
    let metadata = first_file.metadata.as_ref();
    
    // Calculate total duration
    let total_duration: f64 = audio_files.iter()
        .filter_map(|f| f.metadata.as_ref().and_then(|m| m.duration))
        .sum();

    // Create audiobook DTO
    let dto = CreateAudiobookDto {
        title: metadata
            .and_then(|m| m.title.clone())
            .or_else(|| Some(first_file.filename.clone().replace(&first_file.extension, "").trim_end_matches('.').to_string()))
            .unwrap_or_else(|| "Unknown Title".to_string()),
        author: Some(metadata
            .and_then(|m| m.artist.clone())
            .unwrap_or_else(|| "Unknown Author".to_string())),
        narrator: None,
        description: None,
        genre: metadata.and_then(|m| m.genre.clone()),
        file_path: first_file.path.clone(),
        duration: Some((total_duration as i64).max(0)), // Convert float to int seconds
        cover_image_path: None, // Could be enhanced to extract embedded album art
    };

    // Save to database
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };
    
    let repo = AudiobookRepository::new(&pool);
    repo.create(dto).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn import_audiobook_from_directory(
    state: State<'_, AppState>,
    directory_path: String
) -> Result<Audiobook, String> {
    let scanner = FileSystemScanner::new();
    let directory = std::path::Path::new(&directory_path);
    
    // Analyze the directory for audiobook structure
    let audiobook_info = scanner.analyze_audiobook_directory(directory)
        .map_err(|e| format!("Failed to analyze directory: {}", e))?;
    
    // Get database pool
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };
    
    // Create audiobook record
    let audiobook_dto = CreateAudiobookDto {
        title: audiobook_info.title.clone(),
        author: audiobook_info.author.clone(),
        narrator: None,
        description: None,
        genre: None,
        file_path: audiobook_info.directory_path.clone(),
        duration: audiobook_info.total_duration.map(|d| d as i64),
        cover_image_path: None,
    };
    
    let audiobook_repo = AudiobookRepository::new(&pool);
    let mut audiobook = audiobook_repo.create(audiobook_dto).await
        .map_err(|e| format!("Failed to create audiobook: {}", e))?;
    
    // Create chapter records if this is a multi-file audiobook
    if audiobook_info.is_multi_file && !audiobook_info.chapters.is_empty() {
        let chapter_dtos: Vec<CreateChapterDto> = audiobook_info.chapters.iter()
            .map(|ch| CreateChapterDto {
                audiobook_id: audiobook.id.clone(),
                chapter_number: ch.chapter_number,
                title: ch.title.clone(),
                file_path: ch.file_path.clone(),
                duration: ch.duration.map(|d| d as i64),
                file_size: Some(ch.file_size as i64),
            })
            .collect();
        
        let chapter_repo = ChapterRepository::new(&pool);
        let chapters = chapter_repo.create_multiple(chapter_dtos).await
            .map_err(|e| format!("Failed to create chapters: {}", e))?;
        
        // Update audiobook chapters count
        audiobook.chapters_count = chapters.len() as i32;
        
        // Update the audiobook in the database with the correct chapter count
        sqlx::query("UPDATE audiobooks SET chapters_count = ?, updated_at = ? WHERE id = ?")
            .bind(audiobook.chapters_count)
            .bind(chrono::Utc::now().to_rfc3339())
            .bind(&audiobook.id)
            .execute(&pool)
            .await
            .map_err(|e| format!("Failed to update audiobook chapters count: {}", e))?;
    }
    
    Ok(audiobook)
}

#[tauri::command]
async fn find_cover_art(directory_path: String) -> Result<Option<String>, String> {
    let scanner = FileSystemScanner::new();
    let path = std::path::Path::new(&directory_path);
    
    if let Some(cover_path) = scanner.find_cover_art(path) {
        Ok(Some(cover_path.to_string_lossy().to_string()))
    } else {
        Ok(None)
    }
}

#[tauri::command]
async fn get_audio_info(file_path: String) -> Result<AudioInfo, String> {
    audio::AudioEngine::get_audio_info(&file_path).map_err(|e| e.to_string())
}

// Chapter management commands
#[tauri::command]
async fn get_audiobook_chapters(
    state: State<'_, AppState>,
    audiobook_id: String,
) -> Result<Vec<Chapter>, String> {
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };
    
    let repo = ChapterRepository::new(&pool);
    let chapters = repo.find_by_audiobook_id(&audiobook_id).await.map_err(|e| e.to_string())?;
    
    // If no chapters found, try to create them automatically
    if chapters.is_empty() {
        let audiobook_repo = AudiobookRepository::new(&pool);
        if let Ok(Some(audiobook)) = audiobook_repo.find_by_id(&audiobook_id).await {
            // Check if this looks like a TTS audiobook (has description mentioning TTS)
            if audiobook.description.as_deref().unwrap_or("").contains("Text-to-Speech") {
                println!("🔧 TTS: Auto-creating chapters for TTS audiobook: {}", audiobook.title);
                return create_chapters_for_existing_tts_audiobook(&pool, &audiobook).await;
            } else {
                // Try to create chapters for LibriVox/regular audiobooks
                println!("🔧 LIBRIVOX: Auto-creating chapters for LibriVox audiobook: {}", audiobook.title);
                return create_chapters_for_librivox_audiobook(&pool, &audiobook).await;
            }
        }
    }
    
    Ok(chapters)
}

async fn create_chapters_for_existing_tts_audiobook(
    pool: &sqlx::SqlitePool,
    audiobook: &Audiobook,
) -> Result<Vec<Chapter>, String> {
    println!("🔧 TTS: Creating missing chapters for TTS audiobook: {}", audiobook.title);
    
    let output_dir = std::path::Path::new(&audiobook.file_path);
    if !output_dir.exists() {
        return Ok(Vec::new());
    }
    
    // Scan for existing chunk files (each chunk becomes a chapter)
    let mut chapter_files = Vec::new();
    if let Ok(entries) = std::fs::read_dir(output_dir) {
        for entry in entries.flatten() {
            if let Some(file_name) = entry.file_name().to_str() {
                if file_name.ends_with(".wav") && (file_name.starts_with("chapter_") || file_name.starts_with("chunk_")) {
                    // Extract chapter and chunk numbers from filename
                    if let Some(captures) = extract_chapter_chunk_numbers(file_name) {
                        let (chapter_num, chunk_num) = captures;
                        // Create a unique chapter number by combining chapter and chunk
                        let unique_chapter_num = chapter_num * 1000 + chunk_num;
                        chapter_files.push((unique_chapter_num, chapter_num, chunk_num, entry.path()));
                    }
                }
            }
        }
    }
    
    // Sort by unique chapter number
    chapter_files.sort_by_key(|&(unique_num, _, _, _)| unique_num);
    
    let chapter_repo = ChapterRepository::new(pool);
    let mut created_chapters = Vec::new();
    
    for (unique_chapter_num, chapter_num, chunk_num, file_path) in &chapter_files {
        let chapter_title = if *chunk_num == 1 && chapter_files.iter().filter(|(_, ch, _, _)| *ch == *chapter_num).count() == 1 {
            format!("Chapter {}", chapter_num)
        } else {
            format!("Chapter {} - Part {}", chapter_num, chunk_num)
        };
        
        let chapter_dto = CreateChapterDto {
            audiobook_id: audiobook.id.clone(),
            chapter_number: *unique_chapter_num,
            title: chapter_title.clone(),
            file_path: file_path.to_string_lossy().to_string(),
            duration: None,
            file_size: None,
        };
        
        match chapter_repo.create(chapter_dto).await {
            Ok(chapter) => {
                println!("✅ TTS: Created missing chapter record: {}", chapter_title);
                created_chapters.push(chapter);
            },
            Err(e) => {
                println!("⚠️ TTS: Failed to create chapter record '{}': {}", chapter_title, e);
            }
        }
    }
    
    Ok(created_chapters)
}

async fn create_chapters_for_librivox_audiobook(
    pool: &sqlx::SqlitePool,
    audiobook: &Audiobook,
) -> Result<Vec<Chapter>, String> {
    println!("🔧 LIBRIVOX: Creating missing chapters for LibriVox audiobook: {}", audiobook.title);
    
    let audio_dir = std::path::Path::new(&audiobook.file_path);
    if !audio_dir.exists() {
        return Ok(Vec::new());
    }
    
    // Scan for audio files in the directory (each file = one chapter)
    let mut audio_files = Vec::new();
    if let Ok(entries) = std::fs::read_dir(audio_dir) {
        for entry in entries.flatten() {
            if let Some(file_name) = entry.file_name().to_str() {
                let lower_name = file_name.to_lowercase();
                if lower_name.ends_with(".mp3") || lower_name.ends_with(".wav") || 
                   lower_name.ends_with(".m4a") || lower_name.ends_with(".ogg") {
                    audio_files.push((file_name.to_string(), entry.path()));
                }
            }
        }
    }
    
    if audio_files.is_empty() {
        return Ok(Vec::new());
    }
    
    // Sort files naturally (handles numbers properly)
    audio_files.sort_by(|a, b| {
        // Extract numbers from filename for proper sorting
        let extract_number = |s: &str| -> i32 {
            s.chars()
                .filter(|c| c.is_digit(10))
                .collect::<String>()
                .parse::<i32>()
                .unwrap_or(0)
        };
        
        let num_a = extract_number(&a.0);
        let num_b = extract_number(&b.0);
        
        if num_a != num_b {
            num_a.cmp(&num_b)
        } else {
            a.0.cmp(&b.0) // fallback to alphabetical
        }
    });
    
    let chapter_repo = ChapterRepository::new(pool);
    let mut created_chapters = Vec::new();
    
    for (index, (file_name, file_path)) in audio_files.iter().enumerate() {
        // Create a nice chapter title from filename
        let chapter_title = if file_name.to_lowercase().contains("chapter") {
            // Remove file extension and clean up
            file_name.rsplit('.').skip(1).collect::<Vec<_>>().join(".")
                .replace("_", " ")
                .replace("-", " ")
        } else {
            format!("Chapter {}", index + 1)
        };
        
        let chapter_dto = CreateChapterDto {
            audiobook_id: audiobook.id.clone(),
            chapter_number: (index + 1) as i32,
            title: chapter_title,
            file_path: file_path.to_string_lossy().to_string(),
            duration: None,
            file_size: None,
        };
        
        match chapter_repo.create(chapter_dto).await {
            Ok(chapter) => {
                println!("✅ LIBRIVOX: Created chapter: {} -> {}", index + 1, file_name);
                created_chapters.push(chapter);
            }
            Err(e) => {
                println!("❌ LIBRIVOX: Failed to create chapter {}: {}", index + 1, e);
            }
        }
    }
    
    println!("🎉 LIBRIVOX: Created {} chapters for {}", created_chapters.len(), audiobook.title);
    Ok(created_chapters)
}

fn extract_chapter_chunk_numbers(filename: &str) -> Option<(i32, i32)> {
    // Handle patterns like "chapter_1_chunk_1.wav"
    if let Some(stripped) = filename.strip_prefix("chapter_").and_then(|s| s.strip_suffix(".wav")) {
        let parts: Vec<&str> = stripped.split('_').collect();
        if parts.len() >= 3 && parts[1] == "chunk" {
            if let (Ok(chapter), Ok(chunk)) = (parts[0].parse::<i32>(), parts[2].parse::<i32>()) {
                return Some((chapter, chunk));
            }
        }
    }
    // Handle patterns like "chunk_1.wav" (treat as chapter 1, chunk 1)
    else if let Some(stripped) = filename.strip_prefix("chunk_").and_then(|s| s.strip_suffix(".wav")) {
        if let Ok(chunk) = stripped.parse::<i32>() {
            return Some((1, chunk));
        }
    }
    None
}

#[tauri::command]
async fn play_chapter(
    state: State<'_, AppState>,
    chapter_id: String,
) -> Result<Chapter, String> {
    println!("🎵 CHAPTER: Playing chapter with ID: {}", chapter_id);
    
    // Get chapter info from database
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };
    
    let chapter_repo = ChapterRepository::new(&pool);
    let chapter = chapter_repo.find_by_id(&chapter_id).await
        .map_err(|e| e.to_string())?
        .ok_or("Chapter not found")?;
    
    println!("🎵 CHAPTER: Found chapter: {} at {}", chapter.title, chapter.file_path);
    
    // Stop any current audio first to prevent overlap
    let sender = get_audio_sender();
    let (stop_sender, stop_receiver) = mpsc::channel();
    
    sender.send(AudioCommand::Stop { response: stop_sender })
        .map_err(|e| format!("Failed to send stop command: {}", e))?;
        
    stop_receiver.recv()
        .map_err(|e| format!("Failed to receive stop response: {}", e))?
        .map_err(|e| format!("Failed to stop audio: {}", e))?;
    
    // Longer delay to ensure clean stop and resource cleanup
    std::thread::sleep(std::time::Duration::from_millis(200));
    
    // Load and play the chapter file
    let (load_sender, load_receiver) = mpsc::channel();
    
    sender.send(AudioCommand::LoadFile { 
        file_path: chapter.file_path.clone(), 
        response: load_sender 
    }).map_err(|e| format!("Failed to send load command: {}", e))?;
    
    load_receiver.recv()
        .map_err(|e| format!("Failed to receive load response: {}", e))?
        .map_err(|e| format!("Failed to load chapter: {}", e))?;
    
    println!("✅ CHAPTER: Successfully loaded and started playing chapter: {}", chapter.title);
    Ok(chapter)
}

#[tauri::command]
async fn get_chapter_by_number(
    state: State<'_, AppState>,
    audiobook_id: String,
    chapter_number: i32,
) -> Result<Option<Chapter>, String> {
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };
    
    let repo = ChapterRepository::new(&pool);
    repo.get_chapter_by_number(&audiobook_id, chapter_number).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_chapters_for_audiobook(
    state: State<'_, AppState>,
    audiobook_id: String,
) -> Result<Vec<Chapter>, String> {
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };
    
    // Get the audiobook
    let audiobook_repo = AudiobookRepository::new(&pool);
    let audiobook = audiobook_repo.find_by_id(&audiobook_id).await
        .map_err(|e| e.to_string())?
        .ok_or("Audiobook not found")?;
    
    println!("📁 CHAPTERS: Creating chapters for audiobook: {}", audiobook.title);
    
    // Check if chapters already exist
    let chapter_repo = ChapterRepository::new(&pool);
    let existing_chapters = chapter_repo.find_by_audiobook_id(&audiobook_id).await
        .map_err(|e| e.to_string())?;
    
    if !existing_chapters.is_empty() {
        println!("📁 CHAPTERS: Chapters already exist ({})", existing_chapters.len());
        return Ok(existing_chapters);
    }
    
    // Analyze the directory
    let scanner = FileSystemScanner::new();
    let directory = std::path::Path::new(&audiobook.file_path);
    
    if !directory.is_dir() {
        return Err("Audiobook file path is not a directory".to_string());
    }
    
    let audiobook_info = scanner.analyze_audiobook_directory(directory)
        .map_err(|e| format!("Failed to analyze directory: {}", e))?;
    
    if !audiobook_info.is_multi_file || audiobook_info.chapters.is_empty() {
        return Err("Not a multi-file audiobook or no chapters found".to_string());
    }
    
    // Create chapter records
    let chapter_dtos: Vec<CreateChapterDto> = audiobook_info.chapters.iter()
        .map(|ch| CreateChapterDto {
            audiobook_id: audiobook.id.clone(),
            chapter_number: ch.chapter_number,
            title: ch.title.clone(),
            file_path: ch.file_path.clone(),
            duration: ch.duration.map(|d| d as i64),
            file_size: Some(ch.file_size as i64),
        })
        .collect();
    
    let chapters = chapter_repo.create_multiple(chapter_dtos).await
        .map_err(|e| format!("Failed to create chapters: {}", e))?;
    
    // Update audiobook chapters count
    sqlx::query("UPDATE audiobooks SET chapters_count = ?, updated_at = ? WHERE id = ?")
        .bind(chapters.len() as i32)
        .bind(chrono::Utc::now().to_rfc3339())
        .bind(&audiobook.id)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to update audiobook chapters count: {}", e))?;
    
    println!("✅ CHAPTERS: Created {} chapters for audiobook: {}", chapters.len(), audiobook.title);
    Ok(chapters)
}

// Persistence commands
#[tauri::command]
async fn save_playback_state(
    state: State<'_, AppState>,
    audiobook_id: String,
    state_json: String
) -> Result<(), String> {
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };

    let query = r#"
        INSERT OR REPLACE INTO playback_states (audiobook_id, state_data, updated_at)
        VALUES (?, ?, datetime('now'))
    "#;

    sqlx::query(query)
        .bind(&audiobook_id)
        .bind(&state_json)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn load_playback_state(
    state: State<'_, AppState>,
    audiobook_id: String
) -> Result<Option<String>, String> {
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };

    let query = "SELECT state_data FROM playback_states WHERE audiobook_id = ?";

    let result = sqlx::query_scalar::<_, String>(query)
        .bind(&audiobook_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(result)
}

#[tauri::command]
async fn remove_playback_state(
    state: State<'_, AppState>,
    audiobook_id: String
) -> Result<(), String> {
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };

    let query = "DELETE FROM playback_states WHERE audiobook_id = ?";

    sqlx::query(query)
        .bind(&audiobook_id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn save_app_preferences(
    state: State<'_, AppState>,
    preferences: String
) -> Result<(), String> {
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };

    let query = r#"
        INSERT OR REPLACE INTO app_preferences (key, value, updated_at)
        VALUES ('user_preferences', ?, datetime('now'))
    "#;

    sqlx::query(query)
        .bind(&preferences)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn load_app_preferences(
    state: State<'_, AppState>
) -> Result<Option<String>, String> {
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };

    let query = "SELECT value FROM app_preferences WHERE key = 'user_preferences'";

    let result = sqlx::query_scalar::<_, String>(query)
        .fetch_optional(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(result)
}

#[tauri::command]
async fn get_all_playback_states(
    state: State<'_, AppState>
) -> Result<Vec<String>, String> {
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };

    let query = "SELECT state_data FROM playback_states ORDER BY updated_at DESC";

    let results = sqlx::query_scalar::<_, String>(query)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(results)
}

#[tauri::command]
async fn cleanup_old_playback_states(
    state: State<'_, AppState>,
    cutoff_date: String
) -> Result<(), String> {
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };

    let query = "DELETE FROM playback_states WHERE updated_at < ?";

    sqlx::query(query)
        .bind(&cutoff_date)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// Collection management commands
#[tauri::command]
async fn create_collection(
    state: State<'_, AppState>,
    dto: CreateCollectionDto
) -> Result<Collection, String> {
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };

    let repository = CollectionRepository::new(&pool);
    repository.create(dto).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_all_collections(
    state: State<'_, AppState>
) -> Result<Vec<Collection>, String> {
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };

    let repository = CollectionRepository::new(&pool);
    repository.find_all().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_collection_by_id(
    state: State<'_, AppState>,
    id: String
) -> Result<Option<Collection>, String> {
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };

    let repository = CollectionRepository::new(&pool);
    repository.find_by_id(&id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_collection(
    state: State<'_, AppState>,
    id: String,
    dto: CreateCollectionDto
) -> Result<(), String> {
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };

    let repository = CollectionRepository::new(&pool);
    repository.update(&id, dto).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_collection(
    state: State<'_, AppState>,
    id: String
) -> Result<(), String> {
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };

    let repository = CollectionRepository::new(&pool);
    repository.delete(&id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn add_audiobook_to_collection(
    state: State<'_, AppState>,
    collection_id: String,
    audiobook_id: String
) -> Result<(), String> {
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };

    let repository = CollectionRepository::new(&pool);
    repository.add_audiobook_to_collection(&collection_id, &audiobook_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn remove_audiobook_from_collection(
    state: State<'_, AppState>,
    collection_id: String,
    audiobook_id: String
) -> Result<(), String> {
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };

    let repository = CollectionRepository::new(&pool);
    repository.remove_audiobook_from_collection(&collection_id, &audiobook_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_collection_audiobooks(
    state: State<'_, AppState>,
    collection_id: String
) -> Result<Vec<Audiobook>, String> {
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };

    let repository = CollectionRepository::new(&pool);
    repository.get_collection_audiobooks(&collection_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn reorder_collection_audiobooks(
    state: State<'_, AppState>,
    collection_id: String,
    audiobook_orders: Vec<(String, i32)>
) -> Result<(), String> {
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };

    let repository = CollectionRepository::new(&pool);
    repository.reorder_audiobooks(&collection_id, audiobook_orders).await.map_err(|e| e.to_string())
}

// Helper function to detect likely author from book title patterns
fn detect_author_from_title(title: &str) -> Option<String> {
    let title_lower = title.to_lowercase();
    
    // Classic literature patterns
    if (title_lower.contains("picture") && (title_lower.contains("dorian") || title_lower.contains("gray") || title_lower.contains("grey")))
        || title_lower.contains("wilde") 
        || title_lower.contains("importance of being earnest")
        || title_lower.contains("canterville ghost") {
        return Some("wilde".to_string());
    }
    
    if (title_lower.contains("pride") && title_lower.contains("prejudice"))
        || title_lower.contains("sense and sensibility")
        || title_lower.contains("emma")
        || (title_lower.contains("jane") && title_lower.contains("austen")) {
        return Some("austen".to_string());
    }
    
    if (title_lower.contains("alice") && title_lower.contains("wonderland"))
        || title_lower.contains("through the looking glass")
        || title_lower.contains("carroll") {
        return Some("carroll".to_string());
    }
    
    if title_lower.contains("great expectations")
        || title_lower.contains("tale of two cities")
        || title_lower.contains("christmas carol")
        || title_lower.contains("oliver twist")
        || title_lower.contains("bleak house")
        || title_lower.contains("david copperfield") {
        return Some("dickens".to_string());
    }
    
    if (title_lower.contains("romeo") && title_lower.contains("juliet"))
        || title_lower.contains("hamlet")
        || title_lower.contains("macbeth")
        || title_lower.contains("othello")
        || title_lower.contains("king lear")
        || title_lower.contains("midsummer night")
        || title_lower.contains("merchant of venice") {
        return Some("shakespeare".to_string());
    }
    
    if title_lower.contains("war and peace")
        || title_lower.contains("anna karenina")
        || title_lower.contains("tolstoy") {
        return Some("tolstoy".to_string());
    }
    
    if title_lower.contains("adventures of huckleberry")
        || title_lower.contains("tom sawyer")
        || title_lower.contains("mark twain") {
        return Some("twain".to_string());
    }
    
    if title_lower.contains("adventures of sherlock")
        || title_lower.contains("sherlock holmes")
        || title_lower.contains("study in scarlet")
        || title_lower.contains("hound of baskervilles")
        || (title_lower.contains("arthur") && title_lower.contains("conan")) {
        return Some("doyle".to_string());
    }
    
    if title_lower.contains("moby dick")
        || title_lower.contains("melville") {
        return Some("melville".to_string());
    }
    
    if title_lower.contains("frankenstein")
        || (title_lower.contains("mary") && title_lower.contains("shelley")) {
        return Some("shelley".to_string());
    }
    
    if title_lower.contains("dracula")
        || title_lower.contains("bram stoker") {
        return Some("stoker".to_string());
    }
    
    None
}

// LibriVox search command
#[derive(Debug, Clone, serde::Deserialize)]
struct LibriVoxSearchParams {
    author: Option<String>,
    title: Option<String>,
    genre: Option<String>,
    language: Option<String>,
    limit: Option<u32>,
}

#[tauri::command]
async fn search_librivox(params: LibriVoxSearchParams) -> Result<serde_json::Value, String> {
    println!("🌐 LIBRIVOX: Searching with params: {:?}", params);
    
    // Try multiple search strategies
    let mut search_strategies = Vec::new();
    
    // Strategy 1: Original search
    if params.title.is_some() || params.author.is_some() || params.genre.is_some() {
        search_strategies.push(params.clone());
    }
    
    // Strategy 2: Try different title variations and smart author detection
    if let Some(title) = &params.title {
        let title_lower = title.to_lowercase();
        
        // Smart author detection for common books (this works better than title searches)
        let author_guess = detect_author_from_title(&title_lower);
        if let Some(author) = author_guess {
            search_strategies.push(LibriVoxSearchParams {
                author: Some(author),
                title: None,
                genre: params.genre.clone(),
                language: params.language.clone(),
                limit: params.limit,
            });
        }
        
        // Try searching without common articles
        let cleaned_title = title_lower
            .replace("the ", "")
            .replace("a ", "")
            .replace("an ", "");
        
        if !cleaned_title.is_empty() && cleaned_title != title_lower {
            search_strategies.push(LibriVoxSearchParams {
                author: params.author.clone(),
                title: Some(cleaned_title),
                genre: params.genre.clone(),
                language: params.language.clone(),
                limit: params.limit,
            });
        }
        
        // Strategy 3: Try progressive title shortening (useful for partial searches)
        let words: Vec<&str> = title_lower.split_whitespace().collect();
        if words.len() > 2 {
            // Try first 2 words
            let short_title = words[..2].join(" ");
            if short_title != title_lower {
                search_strategies.push(LibriVoxSearchParams {
                    author: params.author.clone(),
                    title: Some(short_title),
                    genre: params.genre.clone(),
                    language: params.language.clone(),
                    limit: params.limit,
                });
            }
            
            // Try just the first word if it's substantial
            if words[0].len() > 3 {
                search_strategies.push(LibriVoxSearchParams {
                    author: params.author.clone(),
                    title: Some(words[0].to_string()),
                    genre: params.genre.clone(),
                    language: params.language.clone(),
                    limit: params.limit,
                });
            }
        }
        
        // Strategy 4: Try a broad search with no title (get all books) - ONLY if we have no other strategies
        // This is useful when specific title searches fail, but don't do it if we already have good strategies
        if search_strategies.len() <= 1 { // Only original strategy exists
            search_strategies.push(LibriVoxSearchParams {
                author: None,
                title: None,
                genre: params.genre.clone(),
                language: params.language.clone(),
                limit: Some(50), // Get more results for broad search
            });
        }
    }
    
    // Try each strategy until we get results
    for (index, strategy) in search_strategies.iter().enumerate() {
        println!("🔍 LIBRIVOX: Trying search strategy {}: {:?}", index + 1, strategy);
        
        match try_librivox_search(&strategy).await {
            Ok(results) => {
                println!("✅ LIBRIVOX: Strategy {} succeeded", index + 1);
                return Ok(results);
            },
            Err(e) => {
                println!("❌ LIBRIVOX: Strategy {} failed: {}", index + 1, e);
                continue;
            }
        }
    }
    
    // If all strategies fail, return the last error
    Err("No search strategy succeeded. Try more specific search terms or author names.".to_string())
}

async fn try_librivox_search(params: &LibriVoxSearchParams) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    
    // Use the base LibriVox API URL with query parameters
    let mut url = reqwest::Url::parse("https://librivox.org/api/feed/audiobooks")
        .map_err(|e| format!("Invalid LibriVox URL: {}", e))?;
    
    // Add query parameters according to LibriVox API documentation
    {
        let mut query_pairs = url.query_pairs_mut();
        query_pairs.append_pair("format", "json");
        query_pairs.append_pair("extended", "1"); // Get full data
        
        // Add search parameters as query params, not path segments
        if let Some(author) = &params.author {
            query_pairs.append_pair("author", author);
        }
        if let Some(title) = &params.title {
            query_pairs.append_pair("title", title);
        }
        if let Some(genre) = &params.genre {
            query_pairs.append_pair("genre", genre);
        }
        
        if let Some(limit) = params.limit {
            query_pairs.append_pair("limit", &limit.to_string());
        }
    }
    
    println!("🌐 LIBRIVOX: Request URL: {}", url);
    
    let response = client
        .get(url)
        .header("User-Agent", "AudioVibe/1.0.0")
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| {
            println!("❌ LIBRIVOX: Request failed: {}", e);
            format!("LibriVox API request failed: {}", e)
        })?;
    
    println!("🌐 LIBRIVOX: Got response with status: {}", response.status());
    
    if !response.status().is_success() {
        let error_msg = format!("LibriVox API error: {}", response.status());
        println!("❌ LIBRIVOX: {}", error_msg);
        return Err(error_msg);
    }
    
    // Get response text first for debugging
    let response_text = response
        .text()
        .await
        .map_err(|e| {
            println!("❌ LIBRIVOX: Failed to get response text: {}", e);
            format!("Failed to get response text: {}", e)
        })?;
    
    println!("🌐 LIBRIVOX: Response text length: {}", response_text.len());
    println!("🌐 LIBRIVOX: First 500 chars: {}", 
        if response_text.len() > 500 { &response_text[..500] } else { &response_text });
    
    let json_data: serde_json::Value = serde_json::from_str(&response_text)
        .map_err(|e| {
            println!("❌ LIBRIVOX: Failed to parse JSON: {}", e);
            println!("❌ LIBRIVOX: Response text: {}", response_text);
            format!("Failed to parse LibriVox response: {}", e)
        })?;
    
    let book_count = json_data.get("books")
        .and_then(|b| b.as_array())
        .map(|a| a.len())
        .unwrap_or(0);
    
    println!("🌐 LIBRIVOX: Response received, {} books found", book_count);
    
    if book_count > 0 {
        println!("🌐 LIBRIVOX: First book title: {}", 
            json_data.get("books")
                .and_then(|books| books.as_array())
                .and_then(|arr| arr.first())
                .and_then(|book| book.get("title"))
                .and_then(|title| title.as_str())
                .unwrap_or("Unknown"));
    }
    
    // Only return success if we actually found books
    if book_count == 0 {
        return Err("No books found".to_string());
    }
    
    Ok(json_data)
}

#[tauri::command]
async fn load_and_play_librivox(
    state: State<'_, AppState>, 
    url: String
) -> Result<String, String> {
    println!("📥 LIBRIVOX: Starting download and play process for: {}", url);
    
    // Extract Archive.org identifier from the URL
    let identifier = extract_archive_identifier(&url)
        .ok_or("Could not extract Archive.org identifier from URL")?;
        
    println!("📥 LIBRIVOX: Extracted Archive.org identifier: {}", identifier);
    
    // Get the download manager from app state
    let download_manager = {
        let dm_state = state.download_manager.lock().unwrap();
        match dm_state.as_ref() {
            Some(manager) => manager.clone(),
            None => return Err("Download manager not initialized".to_string()),
        }
    };
    
    // Download individual files from Archive.org
    match download_manager.download_archive_files(&identifier).await {
        Ok(result) => {
            println!("✅ LIBRIVOX: Download completed. Found {} audio files", result.extracted_files.len());
            
            if result.extracted_files.is_empty() {
                return Err("No audio files found for this audiobook".to_string());
            }
            
            // Sort files to get consistent ordering (usually chapter order)
            let mut files = result.extracted_files;
            files.sort();
            
            // Play the first audio file
            let first_file = &files[0];
            let file_path = first_file.to_string_lossy().to_string();
            
            println!("🎵 LIBRIVOX: Playing first file: {}", file_path);
            
            // Send load command to audio thread
            let sender = get_audio_sender();
            let (response_tx, response_rx) = mpsc::channel();
            
            sender.send(AudioCommand::LoadFile { 
                file_path: file_path.clone(), 
                response: response_tx 
            }).map_err(|e| format!("Failed to send load command: {}", e))?;
            
            // Wait for response
            let load_result = response_rx.recv()
                .map_err(|e| format!("Failed to receive load response: {}", e))?;
                
            match load_result {
                Ok(_) => {
                    println!("✅ LIBRIVOX: Successfully loaded and started playing: {}", file_path);
                    Ok(format!("Playing LibriVox audio: {} ({} files available)", 
                        first_file.file_name().unwrap_or_default().to_string_lossy(),
                        files.len()))
                },
                Err(e) => Err(format!("Failed to load audio file: {}", e)),
            }
        }
        Err(e) => {
            println!("❌ LIBRIVOX: Download failed: {}", e);
            Err(format!("Failed to download LibriVox content: {}", e))
        }
    }
}

#[derive(serde::Deserialize)]
struct ImportLibriVoxParams {
    title: String,
    author: String,
    #[serde(rename = "zipUrl")]
    zip_url: String,
    description: String,
    genre: Option<String>,
    runtime: Option<String>,
    #[serde(rename = "coverUrl")]
    cover_url: Option<String>,
}

#[tauri::command]
async fn import_librivox_audiobook(
    state: State<'_, AppState>,
    params: ImportLibriVoxParams
) -> Result<String, String> {
    println!("📥 LIBRIVOX IMPORT: Starting import for: {} by {}", params.title, params.author);
    
    // Extract Archive.org identifier from the ZIP URL
    // ZIP URLs look like: https://archive.org/compress/picturedoriangr_1608_librivox/formats=64KBPS%20MP3&file=/picturedoriangr_1608_librivox.zip
    let identifier = extract_archive_identifier(&params.zip_url)
        .ok_or("Could not extract Archive.org identifier from URL")?;
        
    println!("📥 LIBRIVOX IMPORT: Extracted Archive.org identifier: {}", identifier);
    
    // Get the download manager from app state
    let download_manager = {
        let dm_state = state.download_manager.lock().unwrap();
        match dm_state.as_ref() {
            Some(manager) => manager.clone(),
            None => return Err("Download manager not initialized".to_string()),
        }
    };
    
    // Download individual files from Archive.org instead of ZIP
    match download_manager.download_archive_files(&identifier).await {
        Ok(result) => {
            println!("✅ LIBRIVOX IMPORT: Download completed. Found {} audio files", result.extracted_files.len());
            
            if result.extracted_files.is_empty() {
                return Err("No audio files found for this audiobook".to_string());
            }
            
            // Sort files to get consistent ordering (usually chapter order)
            let mut files = result.extracted_files;
            files.sort();
            
            // Use the first file as the primary file path (we'll store the directory path)
            let first_file = &files[0];
            let local_directory = first_file.parent()
                .ok_or("Could not determine local directory")?
                .to_string_lossy()
                .to_string();
            
            println!("🎵 LIBRIVOX IMPORT: Storing local directory: {}", local_directory);
            
            // Parse runtime to seconds
            let duration_seconds = params.runtime.as_ref()
                .and_then(|runtime| parse_runtime_to_seconds(runtime));
            
            // Download cover image if available
            let cover_image_path = if let Some(cover_url) = &params.cover_url {
                download_cover_image(cover_url, &identifier).await.ok()
            } else {
                None
            };
            
            // Create audiobook record with local directory path
            let pool = {
                let db_state = state.db.lock().unwrap();
                let db = db_state.as_ref().ok_or("Database not initialized")?;
                db.get_pool().map_err(|e| e.to_string())?.clone()
            };
            
            let repository = AudiobookRepository::new(&pool);
            let dto = CreateAudiobookDto {
                title: params.title,
                author: Some(params.author),
                file_path: local_directory, // Store local directory path
                description: Some(params.description),
                genre: params.genre,
                narrator: None,
                duration: duration_seconds,
                cover_image_path,
            };
            
            match repository.create(dto).await {
                Ok(audiobook) => {
                    println!("✅ LIBRIVOX IMPORT: Successfully imported audiobook with ID: {}", audiobook.id);
                    Ok(format!("Successfully imported '{}' with {} audio files. Ready to play immediately!", 
                        audiobook.title, files.len()))
                },
                Err(e) => {
                    println!("❌ LIBRIVOX IMPORT: Database error: {}", e);
                    Err(format!("Failed to save audiobook to database: {}", e))
                }
            }
        }
        Err(e) => {
            println!("❌ LIBRIVOX IMPORT: Download failed: {}", e);
            Err(format!("Failed to download LibriVox content: {}", e))
        }
    }
}

fn extract_archive_identifier(zip_url: &str) -> Option<String> {
    // ZIP URLs look like: https://archive.org/compress/picturedoriangr_1608_librivox/formats=64KBPS%20MP3&file=/picturedoriangr_1608_librivox.zip
    // We want to extract "picturedoriangr_1608_librivox"
    
    if let Some(compress_pos) = zip_url.find("/compress/") {
        let after_compress = &zip_url[compress_pos + 10..]; // Skip "/compress/"
        if let Some(slash_pos) = after_compress.find('/') {
            let identifier = &after_compress[..slash_pos];
            return Some(identifier.to_string());
        }
    }
    
    // Fallback: try to extract from the file parameter
    if let Some(file_param) = zip_url.split("file=/").nth(1) {
        if let Some(dot_pos) = file_param.find('.') {
            let identifier = &file_param[..dot_pos];
            return Some(identifier.to_string());
        }
    }
    
    None
}

// Recommendation system commands
#[tauri::command]
async fn track_listening_session(
    state: State<'_, AppState>,
    dto: CreateListeningHistoryDto
) -> Result<ListeningHistory, String> {
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };

    let recommendation_service = RecommendationService::new(&pool);
    recommendation_service.track_listening_session(dto).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn generate_recommendations(
    state: State<'_, AppState>,
    limit: Option<i32>
) -> Result<Vec<RecommendationWithAudiobook>, String> {
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };

    let recommendation_service = RecommendationService::new(&pool);
    recommendation_service.generate_recommendations(limit).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_current_recommendations(
    state: State<'_, AppState>,
    limit: Option<i32>
) -> Result<Vec<RecommendationWithAudiobook>, String> {
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };

    let recommendation_service = RecommendationService::new(&pool);
    recommendation_service.get_current_recommendations(limit).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn submit_recommendation_feedback(
    state: State<'_, AppState>,
    dto: CreateRecommendationFeedbackDto
) -> Result<RecommendationFeedback, String> {
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };

    let recommendation_service = RecommendationService::new(&pool);
    recommendation_service.submit_recommendation_feedback(dto).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_listening_stats(
    state: State<'_, AppState>
) -> Result<std::collections::HashMap<String, f64>, String> {
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };

    let recommendation_service = RecommendationService::new(&pool);
    recommendation_service.get_listening_stats().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn download_librivox_book(
    state: State<'_, AppState>,
    archive_id: String,
    zip_url: String
) -> Result<serde_json::Value, String> {
    println!("📥 LIBRIVOX BOOK: Downloading {} from {}", archive_id, zip_url);
    
    // Get the download manager from app state
    let download_manager = {
        let dm_state = state.download_manager.lock().unwrap();
        match dm_state.as_ref() {
            Some(manager) => manager.clone(),
            None => return Err("Download manager not initialized".to_string()),
        }
    };
    
    // Download individual files from Archive.org (better than ZIP for LibriVox)
    match download_manager.download_archive_files(&archive_id).await {
        Ok(result) => {
            println!("✅ LIBRIVOX BOOK: Download completed. Found {} audio files", result.extracted_files.len());
            
            if result.extracted_files.is_empty() {
                return Err("No audio files found for this audiobook".to_string());
            }
            
            // Return download result as JSON
            let response = serde_json::json!({
                "local_path": result.local_path.to_string_lossy(),
                "file_count": result.extracted_files.len(),
                "first_file": result.extracted_files.first()
                    .map(|f| f.to_string_lossy().to_string())
                    .unwrap_or_default()
            });
            
            Ok(response)
        }
        Err(e) => {
            println!("❌ LIBRIVOX BOOK: Download failed: {}", e);
            Err(format!("Failed to download LibriVox content: {}", e))
        }
    }
}

#[tauri::command]
async fn process_document(file_path: String) -> Result<ProcessedDocument, String> {
    println!("📄 DOCUMENT: Processing document at: {}", file_path);
    
    let processor = DocumentProcessor::new();
    processor.process_document(&file_path)
        .map_err(|e| {
            println!("❌ DOCUMENT: Failed to process {}: {}", file_path, e);
            e.to_string()
        })
}

#[tauri::command]
async fn extract_thumbnail(identifier: String) -> Result<Option<String>, String> {
    use std::process::Command;
    use std::env;
    
    // Get the path to the extractThumbnail.py script
    let current_dir = env::current_dir().map_err(|e| e.to_string())?;
    let python_script = current_dir.parent()
        .and_then(|p| p.parent())
        .map(|p| p.join("extractThumbnail.py"))
        .ok_or("Could not find extractThumbnail.py script")?;
    
    if !python_script.exists() {
        return Err("extractThumbnail.py not found".to_string());
    }
    
    // Run the Python script to extract thumbnail info
    let output = Command::new("python")
        .arg(python_script)
        .arg("--identifier")
        .arg(&identifier)
        .arg("--info-only")
        .output()
        .map_err(|e| format!("Failed to run Python script: {}", e))?;
    
    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Python script failed: {}", error));
    }
    
    let output_str = String::from_utf8_lossy(&output.stdout);
    
    // Parse the output to extract the best cover URL
    // The Python script should output JSON with cover file info
    if let Ok(cover_info) = serde_json::from_str::<serde_json::Value>(&output_str) {
        if let Some(cover_files) = cover_info.get("cover_files").and_then(|cf| cf.as_array()) {
            if let Some(first_cover) = cover_files.first() {
                if let Some(url) = first_cover.get("url").and_then(|u| u.as_str()) {
                    return Ok(Some(url.to_string()));
                }
            }
        }
    }
    
    Ok(None)
}

// Helper function to parse runtime strings like "1:23:45" into seconds
fn parse_runtime_to_seconds(runtime: &str) -> Option<i64> {
    let parts: Vec<&str> = runtime.split(':').collect();
    match parts.len() {
        1 => {
            // Just minutes
            parts[0].parse::<i64>().ok().map(|m| m * 60)
        }
        2 => {
            // minutes:seconds
            let minutes = parts[0].parse::<i64>().ok()?;
            let seconds = parts[1].parse::<i64>().ok()?;
            Some(minutes * 60 + seconds)
        }
        3 => {
            // hours:minutes:seconds
            let hours = parts[0].parse::<i64>().ok()?;
            let minutes = parts[1].parse::<i64>().ok()?;
            let seconds = parts[2].parse::<i64>().ok()?;
            Some(hours * 3600 + minutes * 60 + seconds)
        }
        _ => None,
    }
}

// Helper function to download cover images
async fn download_cover_image(cover_url: &str, identifier: &str) -> Result<String, String> {
    use std::env;
    
    println!("📸 COVER: Downloading cover from: {}", cover_url);
    
    // Create covers directory in the app's public assets folder
    // This should be accessible via file:// protocol for frontend
    let current_dir = env::current_dir().map_err(|e| e.to_string())?;
    let covers_dir = current_dir.join("data").join("covers");
    tokio::fs::create_dir_all(&covers_dir).await
        .map_err(|e| format!("Failed to create covers directory: {}", e))?;
    
    // Determine file extension from URL or use jpg as default
    let extension = if cover_url.ends_with(".png") { "png" } else { "jpg" };
    let filename = format!("{}.{}", identifier, extension);
    let file_path = covers_dir.join(&filename);
    
    // Download the image
    let client = reqwest::Client::new();
    let response = client.get(cover_url)
        .header("User-Agent", "AudioVibe/1.0.0")
        .send()
        .await
        .map_err(|e| format!("Failed to download cover: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("Cover download failed with status: {}", response.status()));
    }
    
    let bytes = response.bytes().await
        .map_err(|e| format!("Failed to get cover bytes: {}", e))?;
    
    // Save to file
    tokio::fs::write(&file_path, &bytes).await
        .map_err(|e| format!("Failed to save cover image: {}", e))?;
    
    // Convert to base64 data URL for immediate use
    use base64::{Engine as _, engine::general_purpose};
    let base64_data = general_purpose::STANDARD.encode(&bytes);
    let mime_type = if extension == "png" { "image/png" } else { "image/jpeg" };
    let data_url = format!("data:{};base64,{}", mime_type, base64_data);
    
    println!("✅ COVER: Saved cover as base64 data URL (length: {} bytes)", bytes.len());
    
    Ok(data_url)
}

#[tauri::command]
async fn save_audio_file(
    base64_data: String,
    filename: String,
    audiobook_id: String
) -> Result<String, String> {
    use std::env;
    use base64::{Engine as _, engine::general_purpose};
    
    println!("💾 SAVE: Saving audio file: {} for audiobook: {}", filename, audiobook_id);
    
    // Create audiobook_output directory in the app's data folder
    let current_dir = env::current_dir().map_err(|e| e.to_string())?;
    let output_dir = current_dir.join("data").join("audiobook_output").join(&audiobook_id);
    tokio::fs::create_dir_all(&output_dir).await
        .map_err(|e| format!("Failed to create output directory: {}", e))?;
    
    // Decode base64 data
    let audio_bytes = general_purpose::STANDARD.decode(&base64_data)
        .map_err(|e| format!("Failed to decode base64 audio data: {}", e))?;
    
    // Create the full file path
    let file_path = output_dir.join(&filename);
    
    // Save audio file
    tokio::fs::write(&file_path, &audio_bytes).await
        .map_err(|e| format!("Failed to save audio file: {}", e))?;
    
    let full_path = file_path.to_string_lossy().to_string();
    println!("✅ SAVE: Successfully saved audio file: {}", full_path);
    
    Ok(full_path)
}

#[tauri::command]
async fn create_tts_audiobook(
    state: State<'_, AppState>,
    title: String,
    author: Option<String>,
    chapters: Vec<serde_json::Value>
) -> Result<Audiobook, String> {
    println!("🎤 TTS: Creating TTS audiobook: {} by {:?}", title, author);
    
    // Generate unique audiobook ID
    let audiobook_id = uuid::Uuid::new_v4().to_string();
    
    // Create output directory
    let current_dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let output_dir = current_dir.join("data").join("audiobook_output").join(&audiobook_id);
    std::fs::create_dir_all(&output_dir)
        .map_err(|e| format!("Failed to create output directory: {}", e))?;
    
    // Generate a simple cover image for TTS audiobooks
    let cover_image_path = generate_tts_cover(&title, &author, &audiobook_id).await
        .unwrap_or_else(|e| {
            println!("⚠️ TTS: Failed to generate cover: {}", e);
            None
        });
    
    // Get database pool
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };
    
    // Create audiobook record with a placeholder file path that will be updated later
    // For TTS audiobooks, we'll store the directory path for now and update with first audio file later
    let audiobook_dto = CreateAudiobookDto {
        title: title.clone(),
        author: author.clone(),
        narrator: Some("Generated via TTS".to_string()),
        description: Some("Generated via Text-to-Speech".to_string()),
        genre: Some("TTS Generated".to_string()),
        file_path: output_dir.to_string_lossy().to_string(), // Directory path - will be updated when first audio file is saved
        duration: None, // Will be calculated after all chapters are saved
        cover_image_path,
    };
    
    let audiobook_repo = AudiobookRepository::new(&pool);
    let audiobook = audiobook_repo.create(audiobook_dto).await
        .map_err(|e| format!("Failed to create audiobook: {}", e))?;
    
    // Create chapter records based on the input chapters
    let chapter_repo = ChapterRepository::new(&pool);
    for (index, chapter_data) in chapters.iter().enumerate() {
        let default_title = format!("Chapter {}", index + 1);
        let chapter_title = chapter_data.get("title")
            .and_then(|v| v.as_str())
            .unwrap_or(&default_title);
            
        // Create placeholder file path following TTS naming convention
        let placeholder_path = output_dir.join(format!("chapter_{}_chunk_1.wav", index + 1));
        
        let chapter_dto = CreateChapterDto {
            audiobook_id: audiobook.id.clone(),
            chapter_number: (index + 1) as i32,
            title: chapter_title.to_string(),
            file_path: placeholder_path.to_string_lossy().to_string(),
            duration: None,
            file_size: None,
        };
        
        match chapter_repo.create(chapter_dto).await {
            Ok(_) => println!("✅ TTS: Created chapter {} record", index + 1),
            Err(e) => println!("⚠️ TTS: Failed to create chapter {} record: {}", index + 1, e),
        }
    }
    
    println!("✅ TTS: Created audiobook record with ID: {}", audiobook.id);
    Ok(audiobook)
}

async fn generate_tts_cover(
    title: &str,
    author: &Option<String>,
    audiobook_id: &str,
) -> Result<Option<String>, String> {
    use base64::{Engine as _, engine::general_purpose};
    use std::env;
    
    println!("🎨 TTS COVER: Generating cover for: {} by {:?}", title, author);
    
    // Create a simple SVG cover with the title and author
    let author_text = author.as_ref().map(|a| a.as_str()).unwrap_or("Unknown Author");
    
    // Truncate title and author if too long
    let display_title = if title.len() > 30 {
        format!("{}...", &title[..27])
    } else {
        title.to_string()
    };
    
    let display_author = if author_text.len() > 25 {
        format!("{}...", &author_text[..22])
    } else {
        author_text.to_string()
    };
    
    let svg_content = format!(
        r#"<svg width="400" height="600" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
                </linearGradient>
            </defs>
            <rect width="400" height="600" fill="url(#grad)"/>
            <circle cx="200" cy="150" r="60" fill="white" opacity="0.2"/>
            <path d="M170 130 L170 170 L210 150 Z" fill="white" opacity="0.8"/>
            <rect x="30" y="250" width="340" height="2" fill="white" opacity="0.3"/>
            <text x="200" y="300" font-family="Arial,sans-serif" font-size="24" font-weight="bold" 
                  fill="white" text-anchor="middle" dominant-baseline="middle">
                <tspan x="200" dy="0">{}</tspan>
            </text>
            <text x="200" y="350" font-family="Arial,sans-serif" font-size="18" 
                  fill="white" text-anchor="middle" dominant-baseline="middle" opacity="0.8">
                by {}
            </text>
            <text x="200" y="420" font-family="Arial,sans-serif" font-size="14" 
                  fill="white" text-anchor="middle" dominant-baseline="middle" opacity="0.6">
                Generated via Text-to-Speech
            </text>
            <rect x="30" y="480" width="340" height="2" fill="white" opacity="0.3"/>
        </svg>"#,
        display_title, display_author
    );
    
    // Create covers directory
    let current_dir = env::current_dir().map_err(|e| e.to_string())?;
    let covers_dir = current_dir.join("data").join("covers");
    tokio::fs::create_dir_all(&covers_dir).await
        .map_err(|e| format!("Failed to create covers directory: {}", e))?;
    
    // Convert SVG to base64 data URL (browsers can render SVG directly)
    let svg_base64 = general_purpose::STANDARD.encode(svg_content.as_bytes());
    let data_url = format!("data:image/svg+xml;base64,{}", svg_base64);
    
    // Also save as SVG file for reference
    let svg_file_path = covers_dir.join(format!("{}.svg", audiobook_id));
    tokio::fs::write(&svg_file_path, &svg_content).await
        .map_err(|e| format!("Failed to save SVG file: {}", e))?;
    
    println!("✅ TTS COVER: Generated cover as SVG data URL");
    
    Ok(Some(data_url))
}

#[tauri::command]
async fn update_audiobook_file_path(
    state: State<'_, AppState>,
    audiobook_id: String,
    file_path: String
) -> Result<(), String> {
    println!("📝 UPDATE: Updating audiobook {} file path to: {}", audiobook_id, file_path);
    
    // Get database pool
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };
    
    // Update the audiobook's file_path
    sqlx::query("UPDATE audiobooks SET file_path = ? WHERE id = ?")
        .bind(&file_path)
        .bind(&audiobook_id)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to update audiobook file path: {}", e))?;
    
    println!("✅ UPDATE: Successfully updated audiobook file path");
    Ok(())
}

#[tauri::command]
async fn update_chapter_file_path(
    state: State<'_, AppState>,
    audiobook_id: String,
    chapter_number: i32,
    file_path: String
) -> Result<(), String> {
    println!("📝 UPDATE CHAPTER: Updating chapter {} file path to: {}", chapter_number, file_path);
    
    // Get database pool
    let pool = {
        let db_state = state.db.lock().unwrap();
        let db = db_state.as_ref().ok_or("Database not initialized")?;
        db.get_pool().map_err(|e| e.to_string())?.clone()
    };
    
    // Update the chapter's file_path
    sqlx::query("UPDATE chapters SET file_path = ? WHERE audiobook_id = ? AND chapter_number = ?")
        .bind(&file_path)
        .bind(&audiobook_id)
        .bind(&chapter_number)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to update chapter file path: {}", e))?;
    
    println!("✅ UPDATE CHAPTER: Successfully updated chapter file path");
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            db: Mutex::new(None),
            download_manager: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            minimize_window,
            maximize_window,
            close_window, 
            initialize_app,
            get_system_info,
            create_audiobook,
            get_all_audiobooks,
            get_audiobook_by_id,
            search_audiobooks,
            search_audiobooks_with_filters,
            get_distinct_authors,
            get_distinct_genres,
            get_distinct_narrators,
            delete_audiobook,
            update_playback_progress,
            get_playback_progress,
            load_audio_file,
            play_audio,
            pause_audio,
            stop_audio,
            set_volume,
            set_playback_speed,
            get_playback_status,
            seek_audio,
            add_to_queue,
            play_next,
            clear_queue,
            get_queue,
            get_audio_info,
            scan_directory,
            get_file_info,
            import_audiobook_from_files,
            import_audiobook_from_directory,
            get_audiobook_chapters,
            play_chapter,
            get_chapter_by_number,
            create_chapters_for_audiobook,
            find_cover_art,
            save_playback_state,
            load_playback_state,
            remove_playback_state,
            save_app_preferences,
            load_app_preferences,
            get_all_playback_states,
            cleanup_old_playback_states,
            create_collection,
            get_all_collections,
            get_collection_by_id,
            update_collection,
            delete_collection,
            add_audiobook_to_collection,
            remove_audiobook_from_collection,
            get_collection_audiobooks,
            reorder_collection_audiobooks,
            search_librivox,
            load_and_play_librivox,
            import_librivox_audiobook,
            track_listening_session,
            generate_recommendations,
            get_current_recommendations,
            submit_recommendation_feedback,
            get_listening_stats,
            download_librivox_book,
            process_document,
            extract_thumbnail,
            save_audio_file,
            create_tts_audiobook,
            update_audiobook_file_path,
            update_chapter_file_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
