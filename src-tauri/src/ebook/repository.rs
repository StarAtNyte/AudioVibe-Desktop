use crate::database::models::*;
use sqlx::SqlitePool;
use anyhow::{Result, Context};
use chrono::Utc;

pub struct EbookRepository<'a> {
    pool: &'a SqlitePool,
}

impl<'a> EbookRepository<'a> {
    pub fn new(pool: &'a SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn create(&self, dto: CreateEbookDto) -> Result<Ebook> {
        let mut ebook = Ebook::new(dto.title, dto.file_path, dto.file_format);
        ebook.author = dto.author;
        ebook.description = dto.description;
        ebook.genre = dto.genre;
        ebook.language = dto.language;
        ebook.publisher = dto.publisher;
        ebook.publication_date = dto.publication_date;
        ebook.total_pages = dto.total_pages;
        ebook.file_size = dto.file_size;
        ebook.cover_path = dto.cover_path;

        sqlx::query(
            r#"
            INSERT INTO ebooks (
                id, title, author, file_path, file_format, cover_path,
                total_pages, file_size, language, publisher, publication_date,
                description, genre, added_date, modified_date, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&ebook.id)
        .bind(&ebook.title)
        .bind(&ebook.author)
        .bind(&ebook.file_path)
        .bind(&ebook.file_format)
        .bind(&ebook.cover_path)
        .bind(&ebook.total_pages)
        .bind(&ebook.file_size)
        .bind(&ebook.language)
        .bind(&ebook.publisher)
        .bind(&ebook.publication_date)
        .bind(&ebook.description)
        .bind(&ebook.genre)
        .bind(&ebook.added_date)
        .bind(&ebook.modified_date)
        .bind(&ebook.created_at)
        .bind(&ebook.updated_at)
        .execute(self.pool)
        .await
        .context("Failed to create ebook")?;

        Ok(ebook)
    }

    pub async fn find_by_id(&self, id: &str) -> Result<Option<Ebook>> {
        let ebook = sqlx::query_as::<_, Ebook>(
            "SELECT * FROM ebooks WHERE id = ?"
        )
        .bind(id)
        .fetch_optional(self.pool)
        .await
        .context("Failed to find ebook by id")?;

        Ok(ebook)
    }

    pub async fn find_all(&self) -> Result<Vec<Ebook>> {
        let ebooks = sqlx::query_as::<_, Ebook>(
            "SELECT * FROM ebooks ORDER BY added_date DESC"
        )
        .fetch_all(self.pool)
        .await
        .context("Failed to fetch all ebooks")?;

        Ok(ebooks)
    }

    pub async fn update(&self, id: &str, dto: UpdateEbookDto) -> Result<Ebook> {
        let now = Utc::now().to_rfc3339();

        sqlx::query(
            r#"
            UPDATE ebooks
            SET title = COALESCE(?, title),
                author = COALESCE(?, author),
                description = COALESCE(?, description),
                genre = COALESCE(?, genre),
                cover_path = COALESCE(?, cover_path),
                publisher = COALESCE(?, publisher),
                publication_date = COALESCE(?, publication_date),
                modified_date = ?,
                updated_at = ?
            WHERE id = ?
            "#,
        )
        .bind(&dto.title)
        .bind(&dto.author)
        .bind(&dto.description)
        .bind(&dto.genre)
        .bind(&dto.cover_path)
        .bind(&dto.publisher)
        .bind(&dto.publication_date)
        .bind(&now)
        .bind(&now)
        .bind(id)
        .execute(self.pool)
        .await
        .context("Failed to update ebook")?;

        self.find_by_id(id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("Ebook not found after update"))
    }

    pub async fn delete(&self, id: &str) -> Result<()> {
        sqlx::query("DELETE FROM ebooks WHERE id = ?")
            .bind(id)
            .execute(self.pool)
            .await
            .context("Failed to delete ebook")?;

        Ok(())
    }

    pub async fn search(&self, query: &str) -> Result<Vec<Ebook>> {
        let search_pattern = format!("%{}%", query);

        let ebooks = sqlx::query_as::<_, Ebook>(
            r#"
            SELECT * FROM ebooks
            WHERE title LIKE ? OR author LIKE ? OR description LIKE ? OR genre LIKE ?
            ORDER BY
                CASE
                    WHEN title LIKE ? THEN 1
                    WHEN author LIKE ? THEN 2
                    WHEN genre LIKE ? THEN 3
                    ELSE 4
                END,
                added_date DESC
            "#
        )
        .bind(&search_pattern) // title
        .bind(&search_pattern) // author
        .bind(&search_pattern) // description
        .bind(&search_pattern) // genre
        .bind(&search_pattern) // title relevance
        .bind(&search_pattern) // author relevance
        .bind(&search_pattern) // genre relevance
        .fetch_all(self.pool)
        .await
        .context("Failed to search ebooks")?;

        Ok(ebooks)
    }
}

pub struct ReadingProgressRepository<'a> {
    pool: &'a SqlitePool,
}

impl<'a> ReadingProgressRepository<'a> {
    pub fn new(pool: &'a SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn upsert(&self, ebook_id: &str, dto: UpdateReadingProgressDto) -> Result<ReadingProgress> {
        // Check if progress exists
        let existing = self.find_by_ebook_id(ebook_id).await?;

        if let Some(mut progress) = existing {
            // Update existing
            let now = Utc::now().to_rfc3339();

            if let Some(page) = dto.current_page {
                progress.current_page = Some(page);
            }
            if let Some(cfi) = dto.current_cfi {
                progress.current_cfi = Some(cfi);
            }
            if let Some(href) = dto.current_chapter_href {
                progress.current_chapter_href = Some(href);
            }
            if let Some(pct) = dto.percentage_complete {
                progress.percentage_complete = pct;
            }
            if let Some(time) = dto.reading_time_seconds {
                progress.reading_time_seconds = time;
            }
            progress.last_read_date = now.clone();
            progress.updated_at = now.clone();

            sqlx::query(
                r#"
                UPDATE reading_progress
                SET current_page = ?,
                    current_cfi = ?,
                    current_chapter_href = ?,
                    percentage_complete = ?,
                    reading_time_seconds = ?,
                    last_read_date = ?,
                    updated_at = ?
                WHERE ebook_id = ?
                "#,
            )
            .bind(&progress.current_page)
            .bind(&progress.current_cfi)
            .bind(&progress.current_chapter_href)
            .bind(&progress.percentage_complete)
            .bind(&progress.reading_time_seconds)
            .bind(&progress.last_read_date)
            .bind(&progress.updated_at)
            .bind(ebook_id)
            .execute(self.pool)
            .await
            .context("Failed to update reading progress")?;

            Ok(progress)
        } else {
            // Create new
            let mut progress = ReadingProgress::new(ebook_id.to_string());
            progress.current_page = dto.current_page;
            progress.current_cfi = dto.current_cfi;
            progress.current_chapter_href = dto.current_chapter_href;
            progress.percentage_complete = dto.percentage_complete.unwrap_or(0.0);
            progress.reading_time_seconds = dto.reading_time_seconds.unwrap_or(0);

            sqlx::query(
                r#"
                INSERT INTO reading_progress (
                    id, ebook_id, current_page, current_cfi, current_chapter_href,
                    percentage_complete, reading_time_seconds, last_read_date,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                "#,
            )
            .bind(&progress.id)
            .bind(&progress.ebook_id)
            .bind(&progress.current_page)
            .bind(&progress.current_cfi)
            .bind(&progress.current_chapter_href)
            .bind(&progress.percentage_complete)
            .bind(&progress.reading_time_seconds)
            .bind(&progress.last_read_date)
            .bind(&progress.created_at)
            .bind(&progress.updated_at)
            .execute(self.pool)
            .await
            .context("Failed to create reading progress")?;

            Ok(progress)
        }
    }

    pub async fn find_by_ebook_id(&self, ebook_id: &str) -> Result<Option<ReadingProgress>> {
        let progress = sqlx::query_as::<_, ReadingProgress>(
            "SELECT * FROM reading_progress WHERE ebook_id = ?"
        )
        .bind(ebook_id)
        .fetch_optional(self.pool)
        .await
        .context("Failed to find reading progress")?;

        Ok(progress)
    }
}

pub struct BookmarkRepository<'a> {
    pool: &'a SqlitePool,
}

impl<'a> BookmarkRepository<'a> {
    pub fn new(pool: &'a SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn create(&self, dto: CreateBookmarkDto) -> Result<EbookBookmark> {
        let mut bookmark = EbookBookmark::new(dto.ebook_id);
        bookmark.page_number = dto.page_number;
        bookmark.cfi = dto.cfi;
        bookmark.chapter_title = dto.chapter_title;
        bookmark.note = dto.note;

        sqlx::query(
            r#"
            INSERT INTO ebook_bookmarks (
                id, ebook_id, page_number, cfi, chapter_title, note,
                created_date, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&bookmark.id)
        .bind(&bookmark.ebook_id)
        .bind(&bookmark.page_number)
        .bind(&bookmark.cfi)
        .bind(&bookmark.chapter_title)
        .bind(&bookmark.note)
        .bind(&bookmark.created_date)
        .bind(&bookmark.created_at)
        .bind(&bookmark.updated_at)
        .execute(self.pool)
        .await
        .context("Failed to create bookmark")?;

        Ok(bookmark)
    }

    pub async fn find_by_ebook_id(&self, ebook_id: &str) -> Result<Vec<EbookBookmark>> {
        let bookmarks = sqlx::query_as::<_, EbookBookmark>(
            "SELECT * FROM ebook_bookmarks WHERE ebook_id = ? ORDER BY created_date DESC"
        )
        .bind(ebook_id)
        .fetch_all(self.pool)
        .await
        .context("Failed to find bookmarks")?;

        Ok(bookmarks)
    }

    pub async fn delete(&self, id: &str) -> Result<()> {
        sqlx::query("DELETE FROM ebook_bookmarks WHERE id = ?")
            .bind(id)
            .execute(self.pool)
            .await
            .context("Failed to delete bookmark")?;

        Ok(())
    }
}

pub struct AnnotationRepository<'a> {
    pool: &'a SqlitePool,
}

impl<'a> AnnotationRepository<'a> {
    pub fn new(pool: &'a SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn create(&self, dto: CreateAnnotationDto) -> Result<EbookAnnotation> {
        let mut annotation = EbookAnnotation::new(dto.ebook_id, dto.annotation_type);
        annotation.color = dto.color;
        annotation.cfi_range = dto.cfi_range;
        annotation.position_data = dto.position_data;
        annotation.selected_text = dto.selected_text;
        annotation.note = dto.note;

        sqlx::query(
            r#"
            INSERT INTO ebook_annotations (
                id, ebook_id, annotation_type, color, cfi_range, position_data,
                selected_text, note, created_date, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&annotation.id)
        .bind(&annotation.ebook_id)
        .bind(&annotation.annotation_type)
        .bind(&annotation.color)
        .bind(&annotation.cfi_range)
        .bind(&annotation.position_data)
        .bind(&annotation.selected_text)
        .bind(&annotation.note)
        .bind(&annotation.created_date)
        .bind(&annotation.created_at)
        .bind(&annotation.updated_at)
        .execute(self.pool)
        .await
        .context("Failed to create annotation")?;

        Ok(annotation)
    }

    pub async fn find_by_ebook_id(&self, ebook_id: &str) -> Result<Vec<EbookAnnotation>> {
        let annotations = sqlx::query_as::<_, EbookAnnotation>(
            "SELECT * FROM ebook_annotations WHERE ebook_id = ? ORDER BY created_date DESC"
        )
        .bind(ebook_id)
        .fetch_all(self.pool)
        .await
        .context("Failed to find annotations")?;

        Ok(annotations)
    }

    pub async fn delete(&self, id: &str) -> Result<()> {
        sqlx::query("DELETE FROM ebook_annotations WHERE id = ?")
            .bind(id)
            .execute(self.pool)
            .await
            .context("Failed to delete annotation")?;

        Ok(())
    }
}

pub struct ReaderSettingsRepository<'a> {
    pool: &'a SqlitePool,
}

impl<'a> ReaderSettingsRepository<'a> {
    pub fn new(pool: &'a SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn upsert(&self, ebook_id: &str, dto: UpdateReaderSettingsDto) -> Result<EbookReaderSettings> {
        // Check if settings exist
        let existing = self.find_by_ebook_id(ebook_id).await?;

        if let Some(mut settings) = existing {
            // Update existing
            let now = Utc::now().to_rfc3339();

            if let Some(font_family) = dto.font_family {
                settings.font_family = font_family;
            }
            if let Some(font_size) = dto.font_size {
                settings.font_size = font_size;
            }
            if let Some(line_height) = dto.line_height {
                settings.line_height = line_height;
            }
            if let Some(letter_spacing) = dto.letter_spacing {
                settings.letter_spacing = letter_spacing;
            }
            if let Some(text_align) = dto.text_align {
                settings.text_align = text_align;
            }
            if let Some(theme) = dto.theme {
                settings.theme = theme;
            }
            if let Some(bg_color) = dto.background_color {
                settings.background_color = Some(bg_color);
            }
            if let Some(text_color) = dto.text_color {
                settings.text_color = Some(text_color);
            }
            if let Some(flow_mode) = dto.flow_mode {
                settings.flow_mode = flow_mode;
            }
            settings.updated_at = now;

            sqlx::query(
                r#"
                UPDATE ebook_reader_settings
                SET font_family = ?,
                    font_size = ?,
                    line_height = ?,
                    letter_spacing = ?,
                    text_align = ?,
                    theme = ?,
                    background_color = ?,
                    text_color = ?,
                    flow_mode = ?,
                    updated_at = ?
                WHERE ebook_id = ?
                "#,
            )
            .bind(&settings.font_family)
            .bind(&settings.font_size)
            .bind(&settings.line_height)
            .bind(&settings.letter_spacing)
            .bind(&settings.text_align)
            .bind(&settings.theme)
            .bind(&settings.background_color)
            .bind(&settings.text_color)
            .bind(&settings.flow_mode)
            .bind(&settings.updated_at)
            .bind(ebook_id)
            .execute(self.pool)
            .await
            .context("Failed to update reader settings")?;

            Ok(settings)
        } else {
            // Create new
            let settings = EbookReaderSettings::new(ebook_id.to_string());

            sqlx::query(
                r#"
                INSERT INTO ebook_reader_settings (
                    ebook_id, font_family, font_size, line_height, letter_spacing,
                    text_align, theme, background_color, text_color, flow_mode,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                "#,
            )
            .bind(&settings.ebook_id)
            .bind(&settings.font_family)
            .bind(&settings.font_size)
            .bind(&settings.line_height)
            .bind(&settings.letter_spacing)
            .bind(&settings.text_align)
            .bind(&settings.theme)
            .bind(&settings.background_color)
            .bind(&settings.text_color)
            .bind(&settings.flow_mode)
            .bind(&settings.created_at)
            .bind(&settings.updated_at)
            .execute(self.pool)
            .await
            .context("Failed to create reader settings")?;

            Ok(settings)
        }
    }

    pub async fn find_by_ebook_id(&self, ebook_id: &str) -> Result<Option<EbookReaderSettings>> {
        let settings = sqlx::query_as::<_, EbookReaderSettings>(
            "SELECT * FROM ebook_reader_settings WHERE ebook_id = ?"
        )
        .bind(ebook_id)
        .fetch_optional(self.pool)
        .await
        .context("Failed to find reader settings")?;

        Ok(settings)
    }
}
