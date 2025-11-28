// Metadata extraction module using Symphonia

use super::AudioInfo;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;
use std::fs::{File, metadata};
use std::path::Path;
use anyhow::{Result, Context};

pub fn extract_audio_metadata<P: AsRef<Path>>(path: P) -> Result<AudioInfo> {
    let path = path.as_ref();
    
    // Get file size
    let file_metadata = metadata(path)
        .with_context(|| format!("Failed to read file metadata for: {}", path.display()))?;
    let file_size = file_metadata.len();
    
    // Open the media source
    let file = File::open(path)
        .with_context(|| format!("Failed to open file: {}", path.display()))?;
    
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    // Create a probe hint using the file's extension
    let mut hint = Hint::new();
    if let Some(extension) = path.extension() {
        if let Some(extension_str) = extension.to_str() {
            hint.with_extension(extension_str);
        }
    }

    // Use the default options for metadata and format readers
    let meta_opts: MetadataOptions = Default::default();
    let fmt_opts: FormatOptions = Default::default();

    // Probe the media source
    // Note: For m4b files with large metadata, Symphonia may hit probe limits
    // The codec features (isomp4, alac) help with proper format detection
    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &fmt_opts, &meta_opts)
        .with_context(|| format!("Failed to probe audio format for: {}", path.display()))?;

    let mut format = probed.format;

    // Extract metadata from the format first
    let mut title = None;
    let mut artist = None;
    let mut album = None;

    // Check for metadata in the format  
    if let Some(metadata_rev) = format.metadata().current() {
        for tag in metadata_rev.tags() {
            match tag.key.as_str() {
                "TITLE" | "TIT2" => title = Some(tag.value.to_string()),
                "ARTIST" | "TPE1" => artist = Some(tag.value.to_string()),
                "ALBUM" | "TALB" => album = Some(tag.value.to_string()),
                _ => {}
            }
        }
    }

    // Find the first audio track with a known codec
    let track = format
        .tracks()
        .iter()
        .find(|t| t.codec_params.codec != symphonia::core::codecs::CODEC_TYPE_NULL)
        .ok_or_else(|| anyhow::anyhow!("No supported audio tracks found"))?;

    // Extract technical information
    let codec_params = &track.codec_params;
    let sample_rate = codec_params.sample_rate;
    let channels = codec_params.channels.map(|ch| ch.count() as u16);
    
    // Calculate duration if available
    let duration = if let Some(n_frames) = codec_params.n_frames {
        sample_rate.map(|sr| n_frames / sr as u64)
    } else {
        None
    };

    // Estimate bitrate (this is approximate)
    let bitrate = if let Some(dur) = duration {
        if dur > 0 {
            Some((file_size * 8 / dur / 1000) as u32) // Convert to kbps
        } else {
            None
        }
    } else {
        None
    };

    Ok(AudioInfo {
        title,
        artist,
        album,
        duration,
        file_size,
        sample_rate,
        channels,
        bitrate,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_extract_metadata_invalid_file() {
        let result = extract_audio_metadata("/nonexistent/file.mp3");
        assert!(result.is_err());
    }

    #[test]
    fn test_extract_metadata_invalid_audio() {
        // Create a temporary file with invalid audio data
        let mut temp_file = NamedTempFile::new().unwrap();
        temp_file.write_all(b"not an audio file").unwrap();
        
        let result = extract_audio_metadata(temp_file.path());
        assert!(result.is_err());
    }
}