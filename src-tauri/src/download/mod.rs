use anyhow::{Context, Result};
use futures_util::StreamExt;
use reqwest::Client;
use serde_json::Value;
use std::path::{Path, PathBuf};
use tokio::fs::File;
use tokio::io::AsyncWriteExt;
use zip::ZipArchive;
use std::fs;
use std::io::BufReader;

#[derive(Debug, Clone)]
pub struct DownloadManager {
    client: Client,
    cache_dir: PathBuf,
}

#[derive(Debug, Clone)]
pub struct DownloadResult {
    #[allow(dead_code)]
    pub local_path: PathBuf,
    pub extracted_files: Vec<PathBuf>,
}

impl DownloadManager {
    pub fn new() -> Result<Self> {
        let cache_dir = Self::get_cache_directory()?;
        
        // Create cache directory if it doesn't exist
        if !cache_dir.exists() {
            fs::create_dir_all(&cache_dir)
                .context("Failed to create cache directory")?;
        }
        
        let client = Client::builder()
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .redirect(reqwest::redirect::Policy::limited(20)) // Follow up to 20 redirects for Archive.org
            .timeout(std::time::Duration::from_secs(600)) // 10 minute timeout for large files
            .build()
            .context("Failed to create HTTP client")?;
            
        Ok(Self { client, cache_dir })
    }
    
    fn get_cache_directory() -> Result<PathBuf> {
        // Use platform-appropriate cache directory
        if let Some(cache_dir) = dirs::cache_dir() {
            Ok(cache_dir.join("audiovibe").join("librivox"))
        } else {
            // Fallback to current directory + cache
            Ok(std::env::current_dir()?.join("cache").join("librivox"))
        }
    }
    
    pub async fn download_and_extract_zip(&self, url: &str) -> Result<DownloadResult> {
        println!("📥 DOWNLOAD: Starting download from: {}", url);
        
        // Generate cache filename from URL
        let filename = self.generate_cache_filename(url);
        let zip_path = self.cache_dir.join(&filename);
        let extract_dir = self.cache_dir.join(filename.replace(".zip", ""));
        
        // Check if already cached and extracted
        if extract_dir.exists() {
            println!("💾 CACHE: Using cached extraction at: {}", extract_dir.display());
            let extracted_files = self.list_audio_files(&extract_dir)?;
            return Ok(DownloadResult {
                local_path: extract_dir,
                extracted_files,
            });
        }
        
        // Download the zip file if not already downloaded
        if !zip_path.exists() {
            self.download_file(url, &zip_path).await?;
        } else {
            println!("💾 CACHE: Using cached zip at: {}", zip_path.display());
        }
        
        // Extract the zip file
        let extracted_files = self.extract_zip(&zip_path, &extract_dir).await?;
        
        println!("✅ DOWNLOAD: Successfully extracted {} audio files", extracted_files.len());
        
        Ok(DownloadResult {
            local_path: extract_dir,
            extracted_files,
        })
    }
    
    async fn download_file(&self, url: &str, output_path: &Path) -> Result<()> {
        println!("🌐 DOWNLOAD: Fetching {}", url);
        
        // Archive.org URLs need proper encoding
        let fixed_url = if url.contains("archive.org") && url.contains("formats=64KBPS MP3") {
            // Keep the original format but ensure proper URL encoding
            url.replace("formats=64KBPS MP3", "formats=64KBPS%20MP3")
        } else {
            url.to_string()
        };
        
        if fixed_url != url {
            println!("🔧 DOWNLOAD: URL encoded: {}", fixed_url);
        }
        
        let response = self.client
            .get(&fixed_url)
            .header("Accept", "*/*")
            .header("Accept-Encoding", "identity") // Disable compression for zip files
            .header("Referer", "https://librivox.org/") // Add referer for Archive.org
            .header("Connection", "keep-alive")
            .send()
            .await
            .context("Failed to send download request")?;
        
        // Log the final URL after redirects
        let final_url = response.url().clone();
        println!("🔄 DOWNLOAD: Final URL after redirects: {}", final_url);
            
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!(
                "Download failed with status: {} - Final URL: {} - Response: {}", 
                status,
                final_url,
                if error_text.is_empty() { "No error details" } else { &error_text }
            ));
        }
        
        let total_size = response.content_length();
        if let Some(size) = total_size {
            println!("📊 DOWNLOAD: File size: {} MB", size / 1024 / 1024);
        }
        
        let mut file = File::create(output_path).await
            .context("Failed to create output file")?;
            
        let mut stream = response.bytes_stream();
        let mut downloaded = 0u64;
        
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.context("Failed to read chunk")?;
            file.write_all(&chunk).await.context("Failed to write chunk")?;
            downloaded += chunk.len() as u64;
            
            if let Some(total) = total_size {
                let progress = (downloaded as f64 / total as f64) * 100.0;
                if downloaded % (1024 * 1024) == 0 { // Log every MB
                    println!("📊 DOWNLOAD: Progress: {:.1}% ({} MB / {} MB)", 
                        progress, downloaded / 1024 / 1024, total / 1024 / 1024);
                }
            }
        }
        
        file.flush().await.context("Failed to flush file")?;
        println!("✅ DOWNLOAD: File saved to: {}", output_path.display());
        
        Ok(())
    }
    
    async fn extract_zip(&self, zip_path: &Path, extract_dir: &Path) -> Result<Vec<PathBuf>> {
        println!("📦 EXTRACT: Extracting zip file: {}", zip_path.display());
        
        // Create extraction directory
        if !extract_dir.exists() {
            fs::create_dir_all(extract_dir)
                .context("Failed to create extraction directory")?;
        }
        
        // Open and extract zip file
        let file = fs::File::open(zip_path)
            .context("Failed to open zip file")?;
        let reader = BufReader::new(file);
        let mut archive = ZipArchive::new(reader)
            .context("Failed to read zip archive")?;
        
        let mut extracted_files = Vec::new();
        
        for i in 0..archive.len() {
            let mut file = archive.by_index(i)
                .context("Failed to get file from zip")?;
                
            let file_path = match file.enclosed_name() {
                Some(path) => path,
                None => {
                    println!("⚠️ EXTRACT: Skipping invalid file name at index {}", i);
                    continue;
                }
            };
            
            let output_path = extract_dir.join(&file_path);
            
            // Create parent directories if needed
            if let Some(parent) = output_path.parent() {
                if !parent.exists() {
                    fs::create_dir_all(parent)
                        .context("Failed to create parent directory")?;
                }
            }
            
            // Extract file
            if file.is_file() {
                println!("📁 EXTRACT: Extracting: {}", file_path.display());
                
                let mut output_file = fs::File::create(&output_path)
                    .context("Failed to create extracted file")?;
                    
                std::io::copy(&mut file, &mut output_file)
                    .context("Failed to copy file contents")?;
                
                // Only track audio files
                if self.is_audio_file(&output_path) {
                    extracted_files.push(output_path);
                }
            }
        }
        
        println!("✅ EXTRACT: Extracted {} audio files to: {}", 
            extracted_files.len(), extract_dir.display());
            
        Ok(extracted_files)
    }
    
    fn list_audio_files(&self, dir: &Path) -> Result<Vec<PathBuf>> {
        let mut audio_files = Vec::new();
        
        if dir.is_dir() {
            for entry in fs::read_dir(dir)? {
                let entry = entry?;
                let path = entry.path();
                
                if path.is_file() && self.is_audio_file(&path) {
                    audio_files.push(path);
                }
            }
        }
        
        // Sort files alphabetically for consistent ordering
        audio_files.sort();
        
        Ok(audio_files)
    }
    
    fn is_audio_file(&self, path: &Path) -> bool {
        if let Some(extension) = path.extension() {
            let ext = extension.to_string_lossy().to_lowercase();
            matches!(ext.as_str(), "mp3" | "m4a" | "m4b" | "aac" | "flac" | "wav" | "ogg" | "opus" | "wma")
        } else {
            false
        }
    }
    
    fn generate_cache_filename(&self, url: &str) -> String {
        // Extract filename from URL or generate one based on hash
        if let Some(filename) = url.split('/').last() {
            if filename.contains('.') {
                return filename.to_string();
            }
        }
        
        // Generate filename based on URL hash
        let hash = format!("{:x}", md5::compute(url.as_bytes()));
        format!("{}.zip", hash)
    }
    
    pub async fn download_archive_files(&self, identifier: &str) -> Result<DownloadResult> {
        println!("📥 ARCHIVE.ORG: Starting individual file downloads for identifier: {}", identifier);
        
        // Create extraction directory based on identifier
        let extract_dir = self.cache_dir.join(identifier);
        
        // Check if already cached and extracted
        if extract_dir.exists() {
            println!("💾 CACHE: Using cached files at: {}", extract_dir.display());
            let extracted_files = self.list_audio_files(&extract_dir)?;
            return Ok(DownloadResult {
                local_path: extract_dir,
                extracted_files,
            });
        }
        
        // Get file metadata from Archive.org
        let files = self.get_archive_files_metadata(identifier).await?;
        
        if files.is_empty() {
            return Err(anyhow::anyhow!("No audio files found for identifier: {}", identifier));
        }
        
        // Create extraction directory
        if !extract_dir.exists() {
            fs::create_dir_all(&extract_dir)
                .context("Failed to create extraction directory")?;
        }
        
        let mut extracted_files = Vec::new();
        
        // Download each file individually
        for file_info in files {
            let filename = file_info.get("name")
                .and_then(|n| n.as_str())
                .ok_or_else(|| anyhow::anyhow!("Missing filename in file info"))?;
                
            // Only download audio files
            if !self.is_audio_file_name(filename) {
                continue;
            }
            
            let file_url = format!("https://archive.org/download/{}/{}", identifier, filename);
            let output_path = extract_dir.join(filename);
            
            println!("📥 ARCHIVE.ORG: Downloading: {}", filename);
            
            match self.download_file(&file_url, &output_path).await {
                Ok(_) => {
                    extracted_files.push(output_path);
                    println!("✅ ARCHIVE.ORG: Successfully downloaded: {}", filename);
                },
                Err(e) => {
                    println!("⚠️ ARCHIVE.ORG: Failed to download {}: {}", filename, e);
                    // Continue with other files instead of failing completely
                }
            }
        }
        
        if extracted_files.is_empty() {
            return Err(anyhow::anyhow!("Failed to download any audio files"));
        }
        
        // Sort files for consistent ordering
        extracted_files.sort();
        
        println!("✅ ARCHIVE.ORG: Successfully downloaded {} audio files", extracted_files.len());
        
        Ok(DownloadResult {
            local_path: extract_dir,
            extracted_files,
        })
    }
    
    async fn get_archive_files_metadata(&self, identifier: &str) -> Result<Vec<Value>> {
        let url = format!("https://archive.org/metadata/{}/files?output=json", identifier);
        println!("🌐 ARCHIVE.ORG: Getting file metadata from: {}", url);
        
        let response = self.client
            .get(&url)
            .header("User-Agent", "AudioVibe/1.0.0")
            .header("Accept", "application/json")
            .send()
            .await
            .context("Failed to get Archive.org metadata")?;
            
        if !response.status().is_success() {
            return Err(anyhow::anyhow!(
                "Archive.org metadata request failed with status: {}", 
                response.status()
            ));
        }
        
        let json: Value = response.json().await
            .context("Failed to parse Archive.org metadata JSON")?;
            
        let files = json.get("result")
            .and_then(|r| r.as_array())
            .ok_or_else(|| anyhow::anyhow!("Invalid metadata response format"))?;
            
        // Filter for original audio files (these are the audiobook chapters)
        // Note: We only check for source="original" and audio extension, not track field
        // because some audiobooks don't have track metadata but are still valid chapters
        let audio_files: Vec<Value> = files.iter()
            .filter(|file| {
                let is_original = file.get("source")
                    .and_then(|s| s.as_str())
                    .map(|s| s == "original")
                    .unwrap_or(false);

                let filename = file.get("name")
                    .and_then(|n| n.as_str())
                    .unwrap_or("");

                let is_audio = self.is_audio_file_name(filename);

                // Skip non-original files and files that are clearly not chapters
                // (e.g., _files.xml, _meta.xml, etc.)
                let is_metadata_file = filename.ends_with(".xml") ||
                                      filename.ends_with(".txt") ||
                                      filename.ends_with(".pdf") ||
                                      filename.ends_with(".jpg") ||
                                      filename.ends_with(".png");

                is_original && is_audio && !is_metadata_file
            })
            .cloned()
            .collect();
            
        println!("🌐 ARCHIVE.ORG: Found {} audio files in metadata", audio_files.len());
        
        Ok(audio_files)
    }
    
    fn is_audio_file_name(&self, filename: &str) -> bool {
        let filename_lower = filename.to_lowercase();
        filename_lower.ends_with(".mp3") || 
        filename_lower.ends_with(".m4a") || 
        filename_lower.ends_with(".m4b") || 
        filename_lower.ends_with(".aac") || 
        filename_lower.ends_with(".flac") || 
        filename_lower.ends_with(".wav") || 
        filename_lower.ends_with(".ogg") || 
        filename_lower.ends_with(".opus") || 
        filename_lower.ends_with(".wma")
    }

    #[allow(dead_code)]
    pub fn get_cache_path(&self) -> &Path {
        &self.cache_dir
    }
    
    #[allow(dead_code)]
    pub async fn clear_cache(&self) -> Result<()> {
        if self.cache_dir.exists() {
            fs::remove_dir_all(&self.cache_dir)
                .context("Failed to remove cache directory")?;
            fs::create_dir_all(&self.cache_dir)
                .context("Failed to recreate cache directory")?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_download_manager_creation() {
        let manager = DownloadManager::new().unwrap();
        assert!(manager.cache_dir.exists());
    }
    
    #[test]
    fn test_is_audio_file() {
        let manager = DownloadManager::new().unwrap();
        
        assert!(manager.is_audio_file(Path::new("test.mp3")));
        assert!(manager.is_audio_file(Path::new("test.flac")));
        assert!(!manager.is_audio_file(Path::new("test.txt")));
        assert!(!manager.is_audio_file(Path::new("test")));
    }
}