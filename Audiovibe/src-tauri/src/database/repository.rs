use super::models::*;
use sqlx::SqlitePool;
use anyhow::{Result, Context};
use chrono::Utc;
use uuid::Uuid;

pub struct AudiobookRepository<'a> {
    pool: &'a SqlitePool,
}

impl<'a> AudiobookRepository<'a> {
    pub fn new(pool: &'a SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn create(&self, dto: CreateAudiobookDto) -> Result<Audiobook> {
        let mut audiobook = Audiobook::new(dto.title, dto.file_path);
        audiobook.author = dto.author;
        audiobook.narrator = dto.narrator;
        audiobook.description = dto.description;
        audiobook.genre = dto.genre;
        audiobook.duration = dto.duration;
        audiobook.cover_image_path = dto.cover_image_path;
        
        sqlx::query(
            r#"
            INSERT INTO audiobooks (
                id, title, author, narrator, file_path, description, genre,
                duration, cover_image_path, added_date, chapters_count, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&audiobook.id)
        .bind(&audiobook.title)
        .bind(&audiobook.author)
        .bind(&audiobook.narrator)
        .bind(&audiobook.file_path)
        .bind(&audiobook.description)
        .bind(&audiobook.genre)
        .bind(&audiobook.duration)
        .bind(&audiobook.cover_image_path)
        .bind(&audiobook.added_date)
        .bind(&audiobook.chapters_count)
        .bind(&audiobook.created_at)
        .bind(&audiobook.updated_at)
        .execute(self.pool)
        .await
        .context("Failed to create audiobook")?;

        Ok(audiobook)
    }

    pub async fn find_by_id(&self, id: &str) -> Result<Option<Audiobook>> {
        let audiobook = sqlx::query_as::<_, Audiobook>(
            "SELECT * FROM audiobooks WHERE id = ?"
        )
        .bind(id)
        .fetch_optional(self.pool)
        .await
        .context("Failed to find audiobook by id")?;

        Ok(audiobook)
    }

    pub async fn find_all(&self) -> Result<Vec<Audiobook>> {
        let audiobooks = sqlx::query_as::<_, Audiobook>(
            "SELECT * FROM audiobooks ORDER BY added_date DESC"
        )
        .fetch_all(self.pool)
        .await
        .context("Failed to fetch all audiobooks")?;

        Ok(audiobooks)
    }

    pub async fn search(&self, query: &str) -> Result<Vec<Audiobook>> {
        let search_pattern = format!("%{}%", query);
        
        let audiobooks = sqlx::query_as::<_, Audiobook>(
            r#"
            SELECT * FROM audiobooks 
            WHERE title LIKE ? OR author LIKE ? OR description LIKE ? OR narrator LIKE ? OR genre LIKE ?
            ORDER BY 
                CASE 
                    WHEN title LIKE ? THEN 1
                    WHEN author LIKE ? THEN 2
                    WHEN narrator LIKE ? THEN 3
                    WHEN genre LIKE ? THEN 4
                    ELSE 5
                END,
                added_date DESC
            "#
        )
        .bind(&search_pattern) // title
        .bind(&search_pattern) // author
        .bind(&search_pattern) // description
        .bind(&search_pattern) // narrator
        .bind(&search_pattern) // genre
        .bind(&search_pattern) // title relevance
        .bind(&search_pattern) // author relevance
        .bind(&search_pattern) // narrator relevance
        .bind(&search_pattern) // genre relevance
        .fetch_all(self.pool)
        .await
        .context("Failed to search audiobooks")?;

        Ok(audiobooks)
    }

    pub async fn search_with_filters(&self, filters: SearchFilters) -> Result<Vec<Audiobook>> {
        let mut query = String::from("SELECT * FROM audiobooks WHERE 1=1");
        let mut params: Vec<String> = Vec::new();

        if let Some(search_query) = &filters.query {
            if !search_query.is_empty() {
                query.push_str(" AND (title LIKE ? OR author LIKE ? OR description LIKE ? OR narrator LIKE ? OR genre LIKE ?)");
                let search_pattern = format!("%{}%", search_query);
                params.push(search_pattern.clone());
                params.push(search_pattern.clone());
                params.push(search_pattern.clone());
                params.push(search_pattern.clone());
                params.push(search_pattern);
            }
        }

        if let Some(author) = &filters.author {
            if !author.is_empty() {
                query.push_str(" AND author LIKE ?");
                params.push(format!("%{}%", author));
            }
        }

        if let Some(genre) = &filters.genre {
            if !genre.is_empty() {
                query.push_str(" AND genre LIKE ?");
                params.push(format!("%{}%", genre));
            }
        }

        if let Some(narrator) = &filters.narrator {
            if !narrator.is_empty() {
                query.push_str(" AND narrator LIKE ?");
                params.push(format!("%{}%", narrator));
            }
        }

        if let Some(min_duration) = filters.min_duration {
            query.push_str(" AND duration >= ?");
            params.push(min_duration.to_string());
        }

        if let Some(max_duration) = filters.max_duration {
            query.push_str(" AND duration <= ?");
            params.push(max_duration.to_string());
        }

        if let Some(added_after) = &filters.added_after {
            query.push_str(" AND added_date >= ?");
            params.push(added_after.clone());
        }

        if let Some(added_before) = &filters.added_before {
            query.push_str(" AND added_date <= ?");
            params.push(added_before.clone());
        }

        // Add ordering with relevance scoring if search query exists
        if let Some(search_query) = &filters.query {
            if !search_query.is_empty() {
                query.push_str(
                    " ORDER BY 
                        CASE 
                            WHEN title LIKE ? THEN 1
                            WHEN author LIKE ? THEN 2
                            WHEN narrator LIKE ? THEN 3
                            WHEN genre LIKE ? THEN 4
                            ELSE 5
                        END,
                        added_date DESC"
                );
                let search_pattern = format!("%{}%", search_query);
                params.push(search_pattern.clone());
                params.push(search_pattern.clone());
                params.push(search_pattern.clone());
                params.push(search_pattern);
            }
        } else {
            query.push_str(" ORDER BY added_date DESC");
        }

        let mut sql_query = sqlx::query_as::<_, Audiobook>(&query);
        for param in params {
            sql_query = sql_query.bind(param);
        }

        let audiobooks = sql_query
            .fetch_all(self.pool)
            .await
            .context("Failed to search audiobooks with filters")?;

        Ok(audiobooks)
    }

    pub async fn get_distinct_authors(&self) -> Result<Vec<String>> {
        let authors = sqlx::query_scalar::<_, String>(
            "SELECT DISTINCT author FROM audiobooks WHERE author IS NOT NULL AND author != '' ORDER BY author"
        )
        .fetch_all(self.pool)
        .await
        .context("Failed to fetch distinct authors")?;

        Ok(authors)
    }

    pub async fn get_distinct_genres(&self) -> Result<Vec<String>> {
        let genres = sqlx::query_scalar::<_, String>(
            "SELECT DISTINCT genre FROM audiobooks WHERE genre IS NOT NULL AND genre != '' ORDER BY genre"
        )
        .fetch_all(self.pool)
        .await
        .context("Failed to fetch distinct genres")?;

        Ok(genres)
    }

    pub async fn get_distinct_narrators(&self) -> Result<Vec<String>> {
        let narrators = sqlx::query_scalar::<_, String>(
            "SELECT DISTINCT narrator FROM audiobooks WHERE narrator IS NOT NULL AND narrator != '' ORDER BY narrator"
        )
        .fetch_all(self.pool)
        .await
        .context("Failed to fetch distinct narrators")?;

        Ok(narrators)
    }


    pub async fn delete(&self, id: &str) -> Result<()> {
        sqlx::query("DELETE FROM audiobooks WHERE id = ?")
            .bind(id)
            .execute(self.pool)
            .await
            .context("Failed to delete audiobook")?;

        Ok(())
    }
}

pub struct PlaybackProgressRepository<'a> {
    pool: &'a SqlitePool,
}

impl<'a> PlaybackProgressRepository<'a> {
    pub fn new(pool: &'a SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn create_or_update(&self, audiobook_id: &str, dto: UpdatePlaybackProgressDto) -> Result<PlaybackProgress> {
        let updated_at = Utc::now().to_rfc3339();

        // Try to find existing progress
        let existing = sqlx::query_as::<_, PlaybackProgress>(
            "SELECT * FROM playback_progress WHERE audiobook_id = ?"
        )
        .bind(audiobook_id)
        .fetch_optional(self.pool)
        .await
        .context("Failed to check existing playback progress")?;

        if let Some(mut progress) = existing {
            // Update existing progress
            progress.position = dto.position;
            progress.last_played_at = updated_at.clone();
            progress.updated_at = updated_at;
            
            if let Some(chapter_index) = dto.chapter_index {
                progress.chapter_index = chapter_index;
            }
            if let Some(playback_speed) = dto.playback_speed {
                progress.playback_speed = playback_speed;
            }
            if let Some(is_completed) = dto.is_completed {
                progress.is_completed = is_completed;
            }

            sqlx::query(
                r#"
                UPDATE playback_progress SET
                    position = ?, chapter_index = ?, playback_speed = ?,
                    last_played_at = ?, is_completed = ?, updated_at = ?
                WHERE audiobook_id = ?
                "#
            )
            .bind(&progress.position)
            .bind(&progress.chapter_index)
            .bind(&progress.playback_speed)
            .bind(&progress.last_played_at)
            .bind(&progress.is_completed)
            .bind(&progress.updated_at)
            .bind(audiobook_id)
            .execute(self.pool)
            .await
            .context("Failed to update playback progress")?;

            Ok(progress)
        } else {
            // Create new progress
            let mut progress = PlaybackProgress::new(audiobook_id.to_string());
            progress.position = dto.position;
            progress.last_played_at = updated_at.clone();
            progress.updated_at = updated_at;
            
            if let Some(chapter_index) = dto.chapter_index {
                progress.chapter_index = chapter_index;
            }
            if let Some(playback_speed) = dto.playback_speed {
                progress.playback_speed = playback_speed;
            }
            if let Some(is_completed) = dto.is_completed {
                progress.is_completed = is_completed;
            }

            sqlx::query(
                r#"
                INSERT INTO playback_progress (
                    id, audiobook_id, position, chapter_index, playback_speed,
                    last_played_at, is_completed, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                "#
            )
            .bind(&progress.id)
            .bind(&progress.audiobook_id)
            .bind(&progress.position)
            .bind(&progress.chapter_index)
            .bind(&progress.playback_speed)
            .bind(&progress.last_played_at)
            .bind(&progress.is_completed)
            .bind(&progress.created_at)
            .bind(&progress.updated_at)
            .execute(self.pool)
            .await
            .context("Failed to create playback progress")?;

            Ok(progress)
        }
    }

    pub async fn find_by_audiobook_id(&self, audiobook_id: &str) -> Result<Option<PlaybackProgress>> {
        let progress = sqlx::query_as::<_, PlaybackProgress>(
            "SELECT * FROM playback_progress WHERE audiobook_id = ?"
        )
        .bind(audiobook_id)
        .fetch_optional(self.pool)
        .await
        .context("Failed to find playback progress")?;

        Ok(progress)
    }

}

pub struct CollectionRepository<'a> {
    pool: &'a SqlitePool,
}

impl<'a> CollectionRepository<'a> {
    pub fn new(pool: &'a SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn create(&self, dto: CreateCollectionDto) -> Result<Collection> {
        let mut collection = Collection::new(dto.name);
        
        if let Some(description) = dto.description {
            collection.description = Some(description);
        }
        if let Some(color) = dto.color {
            collection.color = color;
        }

        sqlx::query(
            r#"
            INSERT INTO collections (
                id, name, description, color, is_smart, smart_criteria, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&collection.id)
        .bind(&collection.name)
        .bind(&collection.description)
        .bind(&collection.color)
        .bind(&collection.is_smart)
        .bind(&collection.smart_criteria)
        .bind(&collection.created_at)
        .bind(&collection.updated_at)
        .execute(self.pool)
        .await
        .context("Failed to create collection")?;

        Ok(collection)
    }

    pub async fn find_all(&self) -> Result<Vec<Collection>> {
        let collections = sqlx::query_as::<_, Collection>(
            "SELECT * FROM collections ORDER BY created_at DESC"
        )
        .fetch_all(self.pool)
        .await
        .context("Failed to fetch collections")?;

        Ok(collections)
    }

    pub async fn find_by_id(&self, id: &str) -> Result<Option<Collection>> {
        let collection = sqlx::query_as::<_, Collection>(
            "SELECT * FROM collections WHERE id = ?"
        )
        .bind(id)
        .fetch_optional(self.pool)
        .await
        .context("Failed to fetch collection by id")?;

        Ok(collection)
    }

    pub async fn update(&self, id: &str, dto: CreateCollectionDto) -> Result<()> {
        let updated_at = Utc::now().to_rfc3339();
        
        sqlx::query(
            r#"
            UPDATE collections 
            SET name = ?, description = ?, color = ?, updated_at = ?
            WHERE id = ?
            "#
        )
        .bind(&dto.name)
        .bind(&dto.description)
        .bind(&dto.color.unwrap_or_else(|| "#3B82F6".to_string()))
        .bind(&updated_at)
        .bind(id)
        .execute(self.pool)
        .await
        .context("Failed to update collection")?;

        Ok(())
    }

    pub async fn delete(&self, id: &str) -> Result<()> {
        // First, delete all collection_audiobook relationships
        sqlx::query("DELETE FROM collection_audiobooks WHERE collection_id = ?")
            .bind(id)
            .execute(self.pool)
            .await
            .context("Failed to delete collection audiobook relationships")?;

        // Then delete the collection itself
        sqlx::query("DELETE FROM collections WHERE id = ?")
            .bind(id)
            .execute(self.pool)
            .await
            .context("Failed to delete collection")?;

        Ok(())
    }

    pub async fn add_audiobook_to_collection(&self, collection_id: &str, audiobook_id: &str) -> Result<()> {
        // Check if the audiobook is already in the collection
        let exists = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM collection_audiobooks WHERE collection_id = ? AND audiobook_id = ?"
        )
        .bind(collection_id)
        .bind(audiobook_id)
        .fetch_one(self.pool)
        .await
        .context("Failed to check if audiobook exists in collection")?;

        if exists > 0 {
            return Ok(()); // Already exists, no need to add again
        }

        // Get the next sort order
        let next_sort_order = sqlx::query_scalar::<_, Option<i32>>(
            "SELECT MAX(sort_order) FROM collection_audiobooks WHERE collection_id = ?"
        )
        .bind(collection_id)
        .fetch_one(self.pool)
        .await
        .context("Failed to get next sort order")?
        .unwrap_or(0) + 1;

        let collection_audiobook = CollectionAudiobook {
            id: Uuid::new_v4().to_string(),
            collection_id: collection_id.to_string(),
            audiobook_id: audiobook_id.to_string(),
            added_at: Utc::now().to_rfc3339(),
            sort_order: next_sort_order,
        };

        sqlx::query(
            r#"
            INSERT INTO collection_audiobooks (
                id, collection_id, audiobook_id, added_at, sort_order
            ) VALUES (?, ?, ?, ?, ?)
            "#
        )
        .bind(&collection_audiobook.id)
        .bind(&collection_audiobook.collection_id)
        .bind(&collection_audiobook.audiobook_id)
        .bind(&collection_audiobook.added_at)
        .bind(&collection_audiobook.sort_order)
        .execute(self.pool)
        .await
        .context("Failed to add audiobook to collection")?;

        Ok(())
    }

    pub async fn remove_audiobook_from_collection(&self, collection_id: &str, audiobook_id: &str) -> Result<()> {
        sqlx::query("DELETE FROM collection_audiobooks WHERE collection_id = ? AND audiobook_id = ?")
            .bind(collection_id)
            .bind(audiobook_id)
            .execute(self.pool)
            .await
            .context("Failed to remove audiobook from collection")?;

        Ok(())
    }

    pub async fn get_collection_audiobooks(&self, collection_id: &str) -> Result<Vec<Audiobook>> {
        let audiobooks = sqlx::query_as::<_, Audiobook>(
            r#"
            SELECT a.* FROM audiobooks a
            JOIN collection_audiobooks ca ON a.id = ca.audiobook_id
            WHERE ca.collection_id = ?
            ORDER BY ca.sort_order, ca.added_at
            "#
        )
        .bind(collection_id)
        .fetch_all(self.pool)
        .await
        .context("Failed to fetch collection audiobooks")?;

        Ok(audiobooks)
    }

    pub async fn reorder_audiobooks(&self, collection_id: &str, audiobook_orders: Vec<(String, i32)>) -> Result<()> {
        for (audiobook_id, new_order) in audiobook_orders {
            sqlx::query(
                "UPDATE collection_audiobooks SET sort_order = ? WHERE collection_id = ? AND audiobook_id = ?"
            )
            .bind(new_order)
            .bind(collection_id)
            .bind(&audiobook_id)
            .execute(self.pool)
            .await
            .context("Failed to update audiobook sort order")?;
        }

        Ok(())
    }
}

pub struct ChapterRepository<'a> {
    pool: &'a SqlitePool,
}

impl<'a> ChapterRepository<'a> {
    pub fn new(pool: &'a SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn create(&self, dto: CreateChapterDto) -> Result<Chapter> {
        let mut chapter = Chapter::new(dto.audiobook_id, dto.chapter_number, dto.title, dto.file_path);
        chapter.duration = dto.duration;
        chapter.file_size = dto.file_size;
        
        sqlx::query(
            r#"
            INSERT INTO chapters (
                id, audiobook_id, chapter_number, title, file_path, duration, file_size, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&chapter.id)
        .bind(&chapter.audiobook_id)
        .bind(&chapter.chapter_number)
        .bind(&chapter.title)
        .bind(&chapter.file_path)
        .bind(&chapter.duration)
        .bind(&chapter.file_size)
        .bind(&chapter.created_at)
        .bind(&chapter.updated_at)
        .execute(self.pool)
        .await
        .context("Failed to create chapter")?;

        Ok(chapter)
    }

    pub async fn create_multiple(&self, chapters: Vec<CreateChapterDto>) -> Result<Vec<Chapter>> {
        let mut created_chapters = Vec::new();
        
        for dto in chapters {
            let chapter = self.create(dto).await?;
            created_chapters.push(chapter);
        }
        
        Ok(created_chapters)
    }

    pub async fn find_by_audiobook_id(&self, audiobook_id: &str) -> Result<Vec<Chapter>> {
        let chapters = sqlx::query_as::<_, Chapter>(
            "SELECT * FROM chapters WHERE audiobook_id = ? ORDER BY chapter_number ASC"
        )
        .bind(audiobook_id)
        .fetch_all(self.pool)
        .await
        .context("Failed to fetch chapters for audiobook")?;

        Ok(chapters)
    }

    pub async fn find_by_id(&self, id: &str) -> Result<Option<Chapter>> {
        let chapter = sqlx::query_as::<_, Chapter>(
            "SELECT * FROM chapters WHERE id = ?"
        )
        .bind(id)
        .fetch_optional(self.pool)
        .await
        .context("Failed to fetch chapter")?;

        Ok(chapter)
    }

    pub async fn get_chapter_by_number(&self, audiobook_id: &str, chapter_number: i32) -> Result<Option<Chapter>> {
        let chapter = sqlx::query_as::<_, Chapter>(
            "SELECT * FROM chapters WHERE audiobook_id = ? AND chapter_number = ?"
        )
        .bind(audiobook_id)
        .bind(chapter_number)
        .fetch_optional(self.pool)
        .await
        .context("Failed to fetch chapter by number")?;

        Ok(chapter)
    }

    #[allow(dead_code)]
    pub async fn delete_by_audiobook_id(&self, audiobook_id: &str) -> Result<()> {
        sqlx::query("DELETE FROM chapters WHERE audiobook_id = ?")
            .bind(audiobook_id)
            .execute(self.pool)
            .await
            .context("Failed to delete chapters")?;

        Ok(())
    }

    #[allow(dead_code)]
    pub async fn update_chapter(&self, id: &str, dto: CreateChapterDto) -> Result<()> {
        let now = Utc::now().to_rfc3339();
        
        sqlx::query(
            r#"
            UPDATE chapters 
            SET title = ?, file_path = ?, duration = ?, file_size = ?, updated_at = ?
            WHERE id = ?
            "#
        )
        .bind(&dto.title)
        .bind(&dto.file_path)
        .bind(&dto.duration)
        .bind(&dto.file_size)
        .bind(&now)
        .bind(id)
        .execute(self.pool)
        .await
        .context("Failed to update chapter")?;

        Ok(())
    }
}

