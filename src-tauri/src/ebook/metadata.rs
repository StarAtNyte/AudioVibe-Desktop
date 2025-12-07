use anyhow::{Result, Context};
use std::path::Path;
use crate::database::models::EbookMetadata;

pub struct EbookMetadataExtractor;

impl EbookMetadataExtractor {
    pub fn new() -> Self {
        EbookMetadataExtractor
    }

    pub fn extract_metadata<P: AsRef<Path>>(&self, file_path: P) -> Result<EbookMetadata> {
        let path = file_path.as_ref();
        let extension = path.extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| ext.to_lowercase())
            .ok_or_else(|| anyhow::anyhow!("File has no extension"))?;

        match extension.as_str() {
            "pdf" => self.extract_pdf_metadata(path),
            "epub" => self.extract_epub_metadata(path),
            _ => Err(anyhow::anyhow!("Unsupported file format: {}", extension)),
        }
    }

    fn extract_pdf_metadata<P: AsRef<Path>>(&self, file_path: P) -> Result<EbookMetadata> {
        let path = file_path.as_ref();

        // Extract basic metadata from filename for now
        // TODO: Use pdf crate for better metadata extraction
        let title = path.file_stem()
            .and_then(|stem| stem.to_str())
            .map(|s| s.to_string());

        Ok(EbookMetadata {
            title,
            author: None,
            publisher: None,
            language: None,
            publication_date: None,
            total_pages: None,
            cover_image: None,
            description: None,
        })
    }

    fn extract_epub_metadata<P: AsRef<Path>>(&self, file_path: P) -> Result<EbookMetadata> {
        use epub::doc::EpubDoc;

        let path = file_path.as_ref();
        let mut doc = EpubDoc::new(path)
            .context("Failed to open EPUB file")?;

        let title = doc.mdata("title")
            .map(|item| item.value.clone())
            .or_else(|| {
                path.file_stem()
                    .and_then(|stem| stem.to_str())
                    .map(|s| s.to_string())
            });

        let author = doc.mdata("creator")
            .map(|item| item.value.clone());

        let publisher = doc.mdata("publisher")
            .map(|item| item.value.clone());

        let language = doc.mdata("language")
            .map(|item| item.value.clone());

        let publication_date = doc.mdata("date")
            .map(|item| item.value.clone());

        let description = doc.mdata("description")
            .map(|item| item.value.clone());

        // Extract cover image if available
        let cover_image = doc.get_cover()
            .and_then(|(cover_data, _mime_type)| {
                // Convert to base64
                Some(base64::Engine::encode(&base64::engine::general_purpose::STANDARD, cover_data))
            });

        Ok(EbookMetadata {
            title,
            author,
            publisher,
            language,
            publication_date,
            total_pages: None, // Not easily available for EPUB
            cover_image,
            description,
        })
    }
}
