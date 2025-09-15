mod models;
mod database;
mod audio;
mod filesystem;

use models::{AppConfig, SystemInfo};
use database::{DatabaseManager, models::*, repository::*};
use audio::{AudioManager, AudioInfo, PlaybackStatus, Track};
use filesystem::{FileSystemScanner, AudioFileInfo};
use std::env;
use std::sync::Mutex;
use tauri::State;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust and AudioVibe!", name)
}

// App state to hold database manager only
struct AppState {
    db: Mutex<Option<DatabaseManager>>,
}

// Single thread-local audio manager with global command serialization
thread_local! {
    static AUDIO_MANAGER: std::cell::RefCell<Option<AudioManager>> = std::cell::RefCell::new(None);
}

// Global mutex to ensure only one audio command runs at a time across ALL threads
static AUDIO_COMMAND_MUTEX: std::sync::Mutex<()> = std::sync::Mutex::new(());

// Track which thread has the primary audio manager
use std::sync::OnceLock;
static PRIMARY_AUDIO_THREAD: OnceLock<std::thread::ThreadId> = OnceLock::new();

// Helper function to get or initialize audio manager with global synchronization
fn with_audio_manager<F, R>(f: F) -> Result<R, String>
where
    F: FnOnce(&AudioManager) -> Result<R, String>,
{
    let _lock = AUDIO_COMMAND_MUTEX.lock().unwrap();
    let current_thread = std::thread::current().id();
    
    // Check if we should create or use existing manager
    let should_create = AUDIO_MANAGER.with(|manager_cell| {
        manager_cell.borrow().is_none()
    });
    
    if should_create {
        // Check if this is the first thread to create a manager
        if PRIMARY_AUDIO_THREAD.set(current_thread).is_ok() {
            println!("🆕 PRIMARY MANAGER: Creating primary audio manager (thread: {:?})", current_thread);
            AUDIO_MANAGER.with(|manager_cell| {
                let manager = AudioManager::new()
                    .map_err(|e| format!("Failed to initialize audio manager: {}", e))?;
                *manager_cell.borrow_mut() = Some(manager);
                println!("🆕 PRIMARY MANAGER: Created primary audio manager successfully");
                Ok::<(), String>(())
            })?;
        } else {
            // Another thread already has the primary manager - reject this operation
            let primary_id = *PRIMARY_AUDIO_THREAD.get().unwrap();
            println!("🚫 REJECT: Audio operation on thread {:?}, primary is {:?}", current_thread, primary_id);
            return Err(format!("Audio manager already exists on thread {:?}, rejecting operation on thread {:?}", primary_id, current_thread));
        }
    } else {
        // Check if this is the primary thread
        if let Some(primary_id) = PRIMARY_AUDIO_THREAD.get() {
            if *primary_id != current_thread {
                println!("🚫 REJECT: Audio operation on thread {:?}, primary is {:?}", current_thread, primary_id);
                return Err(format!("Audio operations only allowed on primary thread {:?}, not {:?}", primary_id, current_thread));
            }
        }
        println!("🔄 PRIMARY MANAGER: Reusing primary audio manager (thread: {:?})", current_thread);
    }
    
    AUDIO_MANAGER.with(|manager_cell| {
        let manager_ref = manager_cell.borrow();
        let manager = manager_ref.as_ref().unwrap();
        f(manager)
    })
}