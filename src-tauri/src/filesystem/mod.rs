use std::path::{Path, PathBuf};
use std::fs;
use serde::{Deserialize, Serialize};
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;
use symphonia::default::get_probe;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioFileInfo {
    pub path: String,
    pub filename: String,
    pub size: u64,
    pub extension: String,
    pub metadata: Option<AudioMetadata>,
    pub is_valid: bool,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioMetadata {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub duration: Option<f64>, // Duration in seconds
    pub track_number: Option<u32>,
    pub year: Option<u32>,
    pub genre: Option<String>,
    pub bitrate: Option<u32>,
    pub sample_rate: Option<u32>,
    pub channels: Option<u8>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanProgress {
    pub current_file: String,
    pub files_processed: usize,
    pub total_files: usize,
    pub percentage: f32,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudiobookInfo {
    pub title: String,
    pub author: Option<String>,
    pub directory_path: String,
    pub chapters: Vec<ChapterInfo>,
    pub total_duration: Option<f64>,
    pub is_multi_file: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChapterInfo {
    pub chapter_number: i32,
    pub title: String,
    pub file_path: String,
    pub duration: Option<f64>,
    pub file_size: u64,
}

pub struct FileSystemScanner {
    supported_extensions: Vec<String>,
}

impl FileSystemScanner {
    pub fn new() -> Self {
        Self {
            supported_extensions: vec![
                "mp3".to_string(),
                "m4a".to_string(),
                "m4b".to_string(),
                "aac".to_string(),
                "flac".to_string(),
                "wav".to_string(),
                "ogg".to_string(),
                "opus".to_string(),
                "wma".to_string(),
            ],
        }
    }

    pub fn is_supported_audio_file(&self, path: &Path) -> bool {
        if let Some(extension) = path.extension() {
            if let Some(ext_str) = extension.to_str() {
                return self.supported_extensions.contains(&ext_str.to_lowercase());
            }
        }
        false
    }

    pub fn scan_directory(&self, directory: &Path) -> Result<Vec<AudioFileInfo>, String> {
        if !directory.exists() {
            return Err("Directory does not exist".to_string());
        }

        if !directory.is_dir() {
            return Err("Path is not a directory".to_string());
        }

        let mut audio_files = Vec::new();
        self.scan_directory_recursive(directory, &mut audio_files)?;
        
        Ok(audio_files)
    }

    fn scan_directory_recursive(
        &self,
        directory: &Path,
        audio_files: &mut Vec<AudioFileInfo>,
    ) -> Result<(), String> {
        let entries = fs::read_dir(directory)
            .map_err(|e| format!("Failed to read directory {}: {}", directory.display(), e))?;

        for entry in entries {
            let entry = entry
                .map_err(|e| format!("Failed to read directory entry: {}", e))?;
            let path = entry.path();

            if path.is_dir() {
                // Recursively scan subdirectories
                self.scan_directory_recursive(&path, audio_files)?;
            } else if self.is_supported_audio_file(&path) {
                let file_info = self.get_audio_file_info(&path);
                audio_files.push(file_info);
            }
        }

        Ok(())
    }

    pub fn get_audio_file_info(&self, path: &Path) -> AudioFileInfo {
        let path_string = path.to_string_lossy().to_string();
        let filename = path.file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let extension = path.extension()
            .unwrap_or_default()
            .to_string_lossy()
            .to_lowercase();

        // Get file size
        let size = fs::metadata(path)
            .map(|m| m.len())
            .unwrap_or(0);

        // Extract metadata
        let (metadata, is_valid, error_message) = match self.extract_metadata(path) {
            Ok(meta) => (Some(meta), true, None),
            Err(e) => (None, false, Some(e)),
        };

        AudioFileInfo {
            path: path_string,
            filename,
            size,
            extension,
            metadata,
            is_valid,
            error_message,
        }
    }

    fn extract_metadata(&self, path: &Path) -> Result<AudioMetadata, String> {
        // Open the media source
        let src = std::fs::File::open(path)
            .map_err(|e| format!("Failed to open file: {}", e))?;

        let mss = MediaSourceStream::new(Box::new(src), Default::default());

        // Create a probe hint using the file's extension
        let mut hint = Hint::new();
        if let Some(extension) = path.extension() {
            if let Some(extension_str) = extension.to_str() {
                hint.with_extension(extension_str);
            }
        }

        // Use the default probe to get a format reader for the media source
        let meta_opts: MetadataOptions = Default::default();
        let fmt_opts: FormatOptions = Default::default();

        // Note: For m4b files with large metadata, Symphonia may hit probe limits
        // The codec features (isomp4, alac) help with proper format detection
        let probed = get_probe()
            .format(&hint, mss, &fmt_opts, &meta_opts)
            .map_err(|e| format!("Failed to probe format: {}", e))?;

        let mut format = probed.format;
        
        let mut metadata = AudioMetadata {
            title: None,
            artist: None,
            album: None,
            duration: None,
            track_number: None,
            year: None,
            genre: None,
            bitrate: None,
            sample_rate: None,
            channels: None,
        };

        // Extract metadata from format metadata
        if let Some(format_metadata) = format.metadata().current() {
            for tag in format_metadata.tags() {
                match tag.key.as_str() {
                    "TITLE" | "TIT2" => metadata.title = Some(tag.value.to_string()),
                    "ARTIST" | "TPE1" => metadata.artist = Some(tag.value.to_string()),
                    "ALBUM" | "TALB" => metadata.album = Some(tag.value.to_string()),
                    "TRACKNUMBER" | "TRCK" => {
                        if let Ok(track_num) = tag.value.to_string().parse::<u32>() {
                            metadata.track_number = Some(track_num);
                        }
                    },
                    "DATE" | "TYER" => {
                        if let Ok(year) = tag.value.to_string().parse::<u32>() {
                            metadata.year = Some(year);
                        }
                    },
                    "GENRE" | "TCON" => metadata.genre = Some(tag.value.to_string()),
                    _ => {},
                }
            }
        }

        // Get track information for duration and audio properties
        if let Some(track) = format.default_track() {
            let params = &track.codec_params;
            
            // Duration
            if let Some(n_frames) = params.n_frames {
                if let Some(sample_rate) = params.sample_rate {
                    metadata.duration = Some(n_frames as f64 / sample_rate as f64);
                }
            }
            
            // Sample rate
            metadata.sample_rate = params.sample_rate;
            
            // Channels
            if let Some(channels) = params.channels {
                metadata.channels = Some(channels.count() as u8);
            }
            
            // Bitrate (if available)
            metadata.bitrate = params.bits_per_sample.map(|bps| bps * params.sample_rate.unwrap_or(44100));
        }

        Ok(metadata)
    }

    pub fn find_cover_art(&self, directory: &Path) -> Option<PathBuf> {
        // First, try common cover art filenames
        let cover_names = [
            "cover.jpg", "cover.jpeg", "cover.png", "cover.webp",
            "folder.jpg", "folder.jpeg", "folder.png", "folder.webp",
            "albumart.jpg", "albumart.jpeg", "albumart.png", "albumart.webp",
            "front.jpg", "front.jpeg", "front.png", "front.webp",
        ];

        for name in &cover_names {
            let cover_path = directory.join(name);
            if cover_path.exists() && cover_path.is_file() {
                return Some(cover_path);
            }
        }

        // If no common names found, look for any image file in the directory
        if let Ok(entries) = fs::read_dir(directory) {
            let image_extensions = ["jpg", "jpeg", "png", "webp", "gif", "bmp"];

            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    if let Some(extension) = path.extension() {
                        if let Some(ext_str) = extension.to_str() {
                            if image_extensions.contains(&ext_str.to_lowercase().as_str()) {
                                return Some(path);
                            }
                        }
                    }
                }
            }
        }

        None
    }

    pub fn analyze_audiobook_directory(&self, directory: &Path) -> Result<AudiobookInfo, String> {
        if !directory.exists() || !directory.is_dir() {
            return Err("Path is not a valid directory".to_string());
        }

        // Scan for audio files in the directory (non-recursive for audiobooks)
        let mut audio_files = Vec::new();
        let entries = fs::read_dir(directory)
            .map_err(|e| format!("Failed to read directory: {}", e))?;

        for entry in entries {
            let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
            let path = entry.path();

            if path.is_file() && self.is_supported_audio_file(&path) {
                let file_info = self.get_audio_file_info(&path);
                // Include audio files even if metadata extraction fails
                // We'll still be able to play them, just won't have metadata initially
                audio_files.push(file_info);
            }
        }

        if audio_files.is_empty() {
            return Err("No valid audio files found in directory".to_string());
        }

        // Sort files by filename for proper chapter order
        audio_files.sort_by(|a, b| a.filename.cmp(&b.filename));

        // Determine if this is a multi-file audiobook
        let is_multi_file = audio_files.len() > 1;

        // Extract audiobook info from the files
        let audiobook_title = self.extract_audiobook_title(&audio_files, directory);
        let audiobook_author = self.extract_audiobook_author(&audio_files);
        
        // Create chapter info from files
        let chapters = self.create_chapter_info_from_files(&audio_files)?;
        
        // Calculate total duration
        let total_duration = chapters.iter()
            .filter_map(|ch| ch.duration)
            .sum::<f64>();
        let total_duration = if total_duration > 0.0 { Some(total_duration) } else { None };

        Ok(AudiobookInfo {
            title: audiobook_title,
            author: audiobook_author,
            directory_path: directory.to_string_lossy().to_string(),
            chapters,
            total_duration,
            is_multi_file,
        })
    }

    fn extract_audiobook_title(&self, files: &[AudioFileInfo], directory: &Path) -> String {
        // Try to get title from metadata first
        if let Some(first_file) = files.first() {
            if let Some(ref metadata) = first_file.metadata {
                if let Some(ref album) = metadata.album {
                    if !album.trim().is_empty() {
                        return album.clone();
                    }
                }
                if let Some(ref title) = metadata.title {
                    if !title.trim().is_empty() && files.len() == 1 {
                        return title.clone();
                    }
                }
            }
        }

        // Fallback to directory name
        directory.file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string()
    }

    fn extract_audiobook_author(&self, files: &[AudioFileInfo]) -> Option<String> {
        // Try to get author from metadata
        if let Some(first_file) = files.first() {
            if let Some(ref metadata) = first_file.metadata {
                if let Some(ref artist) = metadata.artist {
                    if !artist.trim().is_empty() {
                        return Some(artist.clone());
                    }
                }
            }
        }
        None
    }

    fn create_chapter_info_from_files(&self, files: &[AudioFileInfo]) -> Result<Vec<ChapterInfo>, String> {
        let mut chapters = Vec::new();

        for (index, file) in files.iter().enumerate() {
            let chapter_number = (index + 1) as i32;
            let chapter_title = self.extract_chapter_title_from_filename(&file.filename, chapter_number);

            chapters.push(ChapterInfo {
                chapter_number,
                title: chapter_title,
                file_path: file.path.clone(),
                duration: file.metadata.as_ref().and_then(|m| m.duration),
                file_size: file.size,
            });
        }

        Ok(chapters)
    }

    fn extract_chapter_title_from_filename(&self, filename: &str, chapter_number: i32) -> String {
        // Remove file extension
        let name_without_ext = if let Some(pos) = filename.rfind('.') {
            &filename[..pos]
        } else {
            filename
        };

        let lower_name = name_without_ext.to_lowercase();

        // Pattern 1: Look for "Chapter XX" in the filename
        if lower_name.contains("chapter") {
            // Extract the chapter number if present
            if let Some(ch_pos) = lower_name.find("chapter") {
                let after_chapter = &name_without_ext[ch_pos + 7..].trim_start();
                
                // Look for digits after "chapter"
                let mut digits = String::new();
                for ch in after_chapter.chars() {
                    if ch.is_ascii_digit() {
                        digits.push(ch);
                    } else if !digits.is_empty() {
                        break;
                    }
                }
                
                if !digits.is_empty() {
                    return format!("Chapter {}", digits);
                }
            }
        }

        // Pattern 2: Look for numbered files like "01", "02", etc.
        // Extract numbers from the filename
        let mut found_number = None;
        let chars: Vec<char> = name_without_ext.chars().collect();
        
        for i in 0..chars.len() {
            if chars[i].is_ascii_digit() {
                let mut num_str = String::new();
                let mut j = i;
                
                while j < chars.len() && chars[j].is_ascii_digit() {
                    num_str.push(chars[j]);
                    j += 1;
                }
                
                if num_str.len() >= 2 || (num_str.len() == 1 && num_str.parse::<i32>().unwrap_or(0) == chapter_number) {
                    found_number = Some(num_str);
                    break;
                }
            }
        }

        if let Some(num) = found_number {
            return format!("Chapter {}", num);
        }

        // Pattern 3: Use sequential numbering
        format!("Chapter {:02}", chapter_number)
    }

    #[allow(dead_code)]
    fn clean_chapter_title(&self, title: &str) -> String {
        // Replace underscores and multiple spaces with single spaces
        let cleaned = title.replace('_', " ")
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ");

        // Capitalize first letter of each word for better presentation
        cleaned.split_whitespace()
            .map(|word| {
                let mut chars = word.chars();
                match chars.next() {
                    None => String::new(),
                    Some(first) => first.to_uppercase().chain(chars.as_str().to_lowercase().chars()).collect(),
                }
            })
            .collect::<Vec<_>>()
            .join(" ")
    }

}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_supported_extensions() {
        let scanner = FileSystemScanner::new();
        
        assert!(scanner.is_supported_audio_file(Path::new("test.mp3")));
        assert!(scanner.is_supported_audio_file(Path::new("test.M4A")));
        assert!(!scanner.is_supported_audio_file(Path::new("test.txt")));
        assert!(!scanner.is_supported_audio_file(Path::new("test.pdf")));
    }

    #[test]
    fn test_scan_empty_directory() {
        let temp_dir = tempdir().unwrap();
        let scanner = FileSystemScanner::new();
        
        let result = scanner.scan_directory(temp_dir.path()).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn test_scan_nonexistent_directory() {
        let scanner = FileSystemScanner::new();
        let result = scanner.scan_directory(Path::new("/nonexistent/path"));
        
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("does not exist"));
    }
}