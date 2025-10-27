use serde::{Deserialize, Serialize};
use std::path::Path;
use anyhow::{Result, Context};
use regex::Regex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentChapter {
    pub title: String,
    pub text: String,
    pub word_count: usize,
    pub page_start: Option<u32>,
    pub page_end: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessedDocument {
    pub title: String,
    pub author: Option<String>,
    pub chapters: Vec<DocumentChapter>,
    pub format: String,
    pub total_pages: Option<u32>,
    pub total_chapters: usize,
}

pub struct DocumentProcessor;

impl DocumentProcessor {
    pub fn new() -> Self {
        DocumentProcessor
    }

    pub fn process_document<P: AsRef<Path>>(&self, file_path: P) -> Result<ProcessedDocument> {
        let path = file_path.as_ref();
        let extension = path.extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| ext.to_lowercase())
            .ok_or_else(|| anyhow::anyhow!("File has no extension"))?;

        match extension.as_str() {
            "pdf" => self.process_pdf(path),
            "epub" => self.process_epub(path),
            "txt" | "text" => self.process_text(path),
            _ => Err(anyhow::anyhow!("Unsupported file format: {}", extension)),
        }
    }

    fn process_pdf<P: AsRef<Path>>(&self, file_path: P) -> Result<ProcessedDocument> {
        use pdf_extract::extract_text;
        
        let path = file_path.as_ref();
        let title = path.file_stem()
            .and_then(|stem| stem.to_str())
            .unwrap_or("Unknown")
            .to_string();

        let full_text = extract_text(path)
            .context("Failed to extract text from PDF")?;

        // Try to detect chapters
        let chapters = self.detect_chapters(&full_text);
        
        // If no chapters found, split by pages/sections
        let final_chapters = if chapters.len() <= 1 {
            self.split_text_by_sections(&full_text, &title)
        } else {
            chapters
        };

        let total_chapters = final_chapters.len();
        Ok(ProcessedDocument {
            title,
            author: None,
            chapters: final_chapters,
            format: "pdf".to_string(),
            total_pages: None, // PDF page count would require more complex parsing
            total_chapters,
        })
    }

    fn process_epub<P: AsRef<Path>>(&self, file_path: P) -> Result<ProcessedDocument> {
        use epub::doc::EpubDoc;
        
        let path = file_path.as_ref();
        let mut doc = EpubDoc::new(path)
            .context("Failed to open EPUB file")?;

        let title = doc.mdata("title")
            .unwrap_or_else(|| {
                path.file_stem()
                    .and_then(|stem| stem.to_str())
                    .unwrap_or("Unknown")
                    .to_string()
            });

        let author = doc.mdata("creator");

        let mut chapters = Vec::new();
        let mut chapter_count = 0;

        // Iterate through spine (reading order)
        while let Some((content, _mime)) = doc.get_current_str() {
            // Clean HTML and extract text
            let text = self.extract_text_from_html(&content);
            
            if !text.trim().is_empty() && text.len() > 100 {
                chapter_count += 1;
                
                // Try to extract chapter title from content
                let chapter_title = self.extract_chapter_title(&text)
                    .unwrap_or_else(|| format!("Chapter {}", chapter_count));

                chapters.push(DocumentChapter {
                    title: chapter_title,
                    text: text.clone(),
                    word_count: text.split_whitespace().count(),
                    page_start: None,
                    page_end: None,
                });
            }

            if !doc.go_next() {
                break;
            }
        }

        // If no chapters found, combine all text
        if chapters.is_empty() {
            let mut full_text = String::new();
            
            // Go back to the beginning
            let _ = doc.set_current_page(0);
            
            while let Some((content, _)) = doc.get_current_str() {
                let text = self.extract_text_from_html(&content);
                if !text.trim().is_empty() {
                    full_text.push_str(&text);
                    full_text.push_str("\n\n");
                }
                
                if !doc.go_next() {
                    break;
                }
            }

            let word_count = full_text.split_whitespace().count();
            chapters = vec![DocumentChapter {
                title: title.clone(),
                text: full_text,
                word_count,
                page_start: None,
                page_end: None,
            }];
        }

        let total_chapters = chapters.len();
        Ok(ProcessedDocument {
            title,
            author,
            chapters,
            format: "epub".to_string(),
            total_pages: None,
            total_chapters,
        })
    }

    fn process_text<P: AsRef<Path>>(&self, file_path: P) -> Result<ProcessedDocument> {
        let path = file_path.as_ref();
        let title = path.file_stem()
            .and_then(|stem| stem.to_str())
            .unwrap_or("Unknown")
            .to_string();

        let content = std::fs::read_to_string(path)
            .context("Failed to read text file")?;

        let chapters = self.detect_text_chapters(&content, &title);

        let total_chapters = chapters.len();
        Ok(ProcessedDocument {
            title,
            author: None,
            chapters,
            format: "txt".to_string(),
            total_pages: None,
            total_chapters,
        })
    }

    fn detect_chapters(&self, text: &str) -> Vec<DocumentChapter> {
        let chapter_patterns = [
            r"(?i)^(Chapter\s+\d+|CHAPTER\s+\d+).*$",
            r"(?i)^(Part\s+\d+|PART\s+\d+).*$",
            r"^\d+\.\s+[A-Z][A-Za-z\s]+$",
        ];

        for pattern in &chapter_patterns {
            if let Ok(regex) = Regex::new(pattern) {
                let matches: Vec<_> = regex.find_iter(text).collect();
                
                if matches.len() > 1 {
                    let mut chapters = Vec::new();
                    
                    for (i, chapter_match) in matches.iter().enumerate() {
                        let start = chapter_match.start();
                        let end = if i < matches.len() - 1 {
                            matches[i + 1].start()
                        } else {
                            text.len()
                        };
                        
                        let chapter_text = &text[start..end];
                        if chapter_text.len() > 200 {
                            let title = self.extract_chapter_title(chapter_text)
                                .unwrap_or_else(|| format!("Chapter {}", i + 1));
                            
                            chapters.push(DocumentChapter {
                                title,
                                text: chapter_text.trim().to_string(),
                                word_count: chapter_text.split_whitespace().count(),
                                page_start: None,
                                page_end: None,
                            });
                        }
                    }
                    
                    if !chapters.is_empty() {
                        return chapters;
                    }
                }
            }
        }

        Vec::new()
    }

    fn detect_text_chapters(&self, text: &str, title: &str) -> Vec<DocumentChapter> {
        let lines: Vec<&str> = text.lines().collect();
        let mut chapters = Vec::new();
        let mut current_chapter_lines = Vec::new();
        let mut current_title = String::from("Introduction");

        for line in lines {
            let trimmed = line.trim();
            
            if self.is_chapter_header(trimmed) {
                // Save previous chapter if it has content
                if current_chapter_lines.len() > 5 {
                    let chapter_text = current_chapter_lines.join("\n").trim().to_string();
                    chapters.push(DocumentChapter {
                        title: current_title.clone(),
                        text: chapter_text.clone(),
                        word_count: chapter_text.split_whitespace().count(),
                        page_start: None,
                        page_end: None,
                    });
                }
                
                // Start new chapter
                current_title = trimmed.to_string();
                current_chapter_lines.clear();
            } else if !trimmed.is_empty() {
                current_chapter_lines.push(line);
            }
        }

        // Add final chapter
        if current_chapter_lines.len() > 5 {
            let chapter_text = current_chapter_lines.join("\n").trim().to_string();
            chapters.push(DocumentChapter {
                title: current_title,
                text: chapter_text.clone(),
                word_count: chapter_text.split_whitespace().count(),
                page_start: None,
                page_end: None,
            });
        }

        // If no chapters detected, return entire text as one chapter
        if chapters.is_empty() {
            chapters.push(DocumentChapter {
                title: title.to_string(),
                text: text.trim().to_string(),
                word_count: text.split_whitespace().count(),
                page_start: None,
                page_end: None,
            });
        }

        chapters
    }

    fn split_text_by_sections(&self, text: &str, title: &str) -> Vec<DocumentChapter> {
        let words: Vec<&str> = text.split_whitespace().collect();
        let mut chapters = Vec::new();
        let words_per_section = 2000; // ~8-10 minutes of audio
        
        for (i, chunk) in words.chunks(words_per_section).enumerate() {
            let section_text = chunk.join(" ");
            
            if !section_text.trim().is_empty() {
                chapters.push(DocumentChapter {
                    title: format!("{} - Section {}", title, i + 1),
                    text: section_text,
                    word_count: chunk.len(),
                    page_start: None,
                    page_end: None,
                });
            }
        }
        
        if chapters.is_empty() {
            chapters.push(DocumentChapter {
                title: title.to_string(),
                text: text.to_string(),
                word_count: text.split_whitespace().count(),
                page_start: None,
                page_end: None,
            });
        }

        chapters
    }

    fn is_chapter_header(&self, line: &str) -> bool {
        if line.len() > 100 {
            return false;
        }

        let patterns = [
            r"(?i)^(Chapter\s+\d+|CHAPTER\s+\d+)",
            r"(?i)^(Part\s+\d+|PART\s+\d+)",
            r"^\d+\.\s+[A-Z]",
            r"^[A-Z\s]{5,50}$", // All caps titles
        ];

        for pattern in &patterns {
            if let Ok(regex) = Regex::new(pattern) {
                if regex.is_match(line) {
                    return true;
                }
            }
        }

        false
    }

    fn extract_text_from_html(&self, html: &str) -> String {
        // Simple HTML tag removal - for production use a proper HTML parser
        let tag_regex = Regex::new(r"<[^>]*>").unwrap();
        let text = tag_regex.replace_all(html, " ");
        
        // Clean up whitespace
        let whitespace_regex = Regex::new(r"\s+").unwrap();
        whitespace_regex.replace_all(&text, " ").trim().to_string()
    }

    fn extract_chapter_title(&self, text: &str) -> Option<String> {
        let lines: Vec<&str> = text.lines().take(5).collect();
        
        for line in lines {
            let trimmed = line.trim();
            
            // Look for chapter patterns
            let patterns = [
                r"(?i)^(Chapter\s+\d+.*)",
                r"(?i)^(Part\s+\d+.*)",
                r"^\d+\.\s+[A-Z].*",
                r"^[A-Z\s]{5,100}$",
            ];
            
            for pattern in &patterns {
                if let Ok(regex) = Regex::new(pattern) {
                    if regex.is_match(trimmed) && trimmed.len() < 100 {
                        return Some(trimmed.to_string());
                    }
                }
            }
        }
        
        None
    }
}