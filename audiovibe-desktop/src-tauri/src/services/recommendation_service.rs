use crate::database::{models::*, repository::AudiobookRepository};
use anyhow::{Result, Context};
use chrono::Utc;
use sqlx::SqlitePool;
use std::collections::HashMap;

pub struct RecommendationService<'a> {
    pool: &'a SqlitePool,
}

impl<'a> RecommendationService<'a> {
    pub fn new(pool: &'a SqlitePool) -> Self {
        Self { pool }
    }

    // Track listening session
    pub async fn track_listening_session(&self, dto: CreateListeningHistoryDto) -> Result<ListeningHistory> {
        let mut history = ListeningHistory::new(
            dto.audiobook_id.clone(),
            dto.position_seconds,
            dto.session_duration,
        );

        // Calculate completion percentage if duration is provided
        if let Some(duration) = dto.duration_seconds {
            if duration > 0 {
                history.duration_seconds = Some(duration);
                history.completion_percentage = (dto.position_seconds as f64 / duration as f64).min(1.0);
            }
        }

        if let Some(speed) = dto.playback_speed {
            history.playback_speed = speed;
        }

        sqlx::query(
            r#"
            INSERT INTO listening_history (
                id, audiobook_id, listened_at, position_seconds, duration_seconds,
                completion_percentage, session_duration, playback_speed, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&history.id)
        .bind(&history.audiobook_id)
        .bind(&history.listened_at)
        .bind(&history.position_seconds)
        .bind(&history.duration_seconds)
        .bind(&history.completion_percentage)
        .bind(&history.session_duration)
        .bind(&history.playback_speed)
        .bind(&history.created_at)
        .execute(self.pool)
        .await
        .context("Failed to insert listening history")?;

        // Update user preferences based on this session
        self.update_preferences_from_session(&dto.audiobook_id).await?;

        Ok(history)
    }

    // Generate personalized recommendations
    pub async fn generate_recommendations(&self, limit: Option<i32>) -> Result<Vec<RecommendationWithAudiobook>> {
        let limit = limit.unwrap_or(10);
        
        // Clear old recommendations first
        self.cleanup_old_recommendations().await?;

        // Generate different types of recommendations
        let mut all_recommendations = Vec::new();

        // 1. Genre-based recommendations
        let genre_recs = self.generate_genre_based_recommendations(limit / 3).await?;
        all_recommendations.extend(genre_recs);

        // 2. Author-based recommendations
        let author_recs = self.generate_author_based_recommendations(limit / 3).await?;
        all_recommendations.extend(author_recs);

        // 3. Similar audiobooks based on listening patterns
        let similar_recs = self.generate_similar_recommendations(limit / 3).await?;
        all_recommendations.extend(similar_recs);

        // Sort by score and take top recommendations
        all_recommendations.sort_by(|a, b| {
            b.recommendation.recommendation_score
                .partial_cmp(&a.recommendation.recommendation_score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        all_recommendations.truncate(limit as usize);

        // Save recommendations to database
        for rec_with_book in &all_recommendations {
            self.save_recommendation(&rec_with_book.recommendation).await?;
        }

        Ok(all_recommendations)
    }

    // Get user's listening statistics for recommendations
    pub async fn get_listening_stats(&self) -> Result<HashMap<String, f64>> {
        let mut stats = HashMap::new();

        // Genre preferences
        let genre_stats = sqlx::query_as::<_, (String, f64)>(
            r#"
            SELECT COALESCE(a.genre, 'Unknown') as genre, 
                   AVG(lh.completion_percentage) as avg_completion
            FROM listening_history lh
            JOIN audiobooks a ON lh.audiobook_id = a.id
            WHERE a.genre IS NOT NULL AND a.genre != ''
            GROUP BY a.genre
            HAVING COUNT(*) >= 2
            ORDER BY avg_completion DESC
            LIMIT 10
            "#
        )
        .fetch_all(self.pool)
        .await
        .context("Failed to get genre stats")?;

        for (genre, completion) in genre_stats {
            stats.insert(format!("genre_{}", genre), completion);
        }

        // Author preferences
        let author_stats = sqlx::query_as::<_, (String, f64)>(
            r#"
            SELECT COALESCE(a.author, 'Unknown') as author,
                   AVG(lh.completion_percentage) as avg_completion
            FROM listening_history lh
            JOIN audiobooks a ON lh.audiobook_id = a.id
            WHERE a.author IS NOT NULL AND a.author != ''
            GROUP BY a.author
            HAVING COUNT(*) >= 2
            ORDER BY avg_completion DESC
            LIMIT 10
            "#
        )
        .fetch_all(self.pool)
        .await
        .context("Failed to get author stats")?;

        for (author, completion) in author_stats {
            stats.insert(format!("author_{}", author), completion);
        }

        Ok(stats)
    }

    // Provide recommendation feedback
    pub async fn submit_recommendation_feedback(&self, dto: CreateRecommendationFeedbackDto) -> Result<RecommendationFeedback> {
        let feedback = RecommendationFeedback::new(
            dto.recommendation_id.clone(),
            dto.feedback_type,
            dto.feedback_value,
            dto.feedback_reason,
        );

        // Insert feedback
        sqlx::query(
            r#"
            INSERT INTO recommendation_feedback (
                id, recommendation_id, feedback_type, feedback_value, feedback_reason, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&feedback.id)
        .bind(&feedback.recommendation_id)
        .bind(&feedback.feedback_type)
        .bind(&feedback.feedback_value)
        .bind(&feedback.feedback_reason)
        .bind(&feedback.created_at)
        .execute(self.pool)
        .await
        .context("Failed to insert recommendation feedback")?;

        // Update the recommendation with user feedback
        sqlx::query(
            "UPDATE recommendations SET user_feedback = ? WHERE id = ?"
        )
        .bind(&feedback.feedback_value)
        .bind(&dto.recommendation_id)
        .execute(self.pool)
        .await
        .context("Failed to update recommendation feedback")?;

        // Update user preferences based on feedback
        self.update_preferences_from_feedback(&feedback).await?;

        Ok(feedback)
    }

    // Get current recommendations
    pub async fn get_current_recommendations(&self, limit: Option<i32>) -> Result<Vec<RecommendationWithAudiobook>> {
        let limit = limit.unwrap_or(10);
        
        // Get recommendations first
        let recommendations = sqlx::query_as::<_, Recommendation>(
            r#"
            SELECT *
            FROM recommendations r
            WHERE r.is_dismissed = FALSE 
              AND (r.expires_at IS NULL OR r.expires_at > datetime('now'))
            ORDER BY r.recommendation_score DESC
            LIMIT ?
            "#,
        )
        .bind(limit)
        .fetch_all(self.pool)
        .await
        .context("Failed to get current recommendations")?;

        let mut result = Vec::new();
        
        // Get audiobook for each recommendation
        let audiobook_repo = AudiobookRepository::new(self.pool);
        for recommendation in recommendations {
            if let Some(audiobook) = audiobook_repo.find_by_id(&recommendation.audiobook_id).await? {
                result.push(RecommendationWithAudiobook {
                    recommendation,
                    audiobook,
                });
            }
        }

        Ok(result)
    }

    // Private helper methods

    async fn generate_genre_based_recommendations(&self, limit: i32) -> Result<Vec<RecommendationWithAudiobook>> {
        let preferred_genres = sqlx::query_as::<_, (String, f64)>(
            r#"
            SELECT a.genre, AVG(lh.completion_percentage) as score
            FROM listening_history lh
            JOIN audiobooks a ON lh.audiobook_id = a.id
            WHERE a.genre IS NOT NULL AND a.genre != ''
            GROUP BY a.genre
            HAVING COUNT(*) >= 2
            ORDER BY score DESC
            LIMIT 5
            "#,
        )
        .fetch_all(self.pool)
        .await
        .context("Failed to get preferred genres")?;

        if preferred_genres.is_empty() {
            return Ok(Vec::new());
        }

        let mut recommendations = Vec::new();
        let genre_count = preferred_genres.len() as i32;
        
        for (genre, preference_score) in preferred_genres {
            let books = sqlx::query_as::<_, Audiobook>(
                r#"
                SELECT a.* FROM audiobooks a
                LEFT JOIN listening_history lh ON a.id = lh.audiobook_id
                WHERE a.genre = ? AND lh.audiobook_id IS NULL
                ORDER BY a.added_date DESC
                LIMIT ?
                "#,
            )
            .bind(&genre)
            .bind(limit / genre_count)
            .fetch_all(self.pool)
            .await
            .context("Failed to get genre-based recommendations")?;

            for book in books {
                let recommendation = Recommendation::new(
                    book.id.clone(),
                    "genre_preference".to_string(),
                    preference_score * 0.8, // Scale down genre recommendations
                    Some(format!("Because you enjoy {} audiobooks", genre)),
                );

                recommendations.push(RecommendationWithAudiobook {
                    recommendation,
                    audiobook: book,
                });
            }
        }

        Ok(recommendations)
    }

    async fn generate_author_based_recommendations(&self, limit: i32) -> Result<Vec<RecommendationWithAudiobook>> {
        let preferred_authors = sqlx::query_as::<_, (String, f64)>(
            r#"
            SELECT a.author, AVG(lh.completion_percentage) as score
            FROM listening_history lh
            JOIN audiobooks a ON lh.audiobook_id = a.id
            WHERE a.author IS NOT NULL AND a.author != ''
            GROUP BY a.author
            HAVING COUNT(*) >= 1 AND AVG(lh.completion_percentage) > 0.5
            ORDER BY score DESC
            LIMIT 5
            "#,
        )
        .fetch_all(self.pool)
        .await
        .context("Failed to get preferred authors")?;

        if preferred_authors.is_empty() {
            return Ok(Vec::new());
        }

        let mut recommendations = Vec::new();
        let author_count = preferred_authors.len() as i32;
        
        for (author, preference_score) in preferred_authors {
            let books = sqlx::query_as::<_, Audiobook>(
                r#"
                SELECT a.* FROM audiobooks a
                LEFT JOIN listening_history lh ON a.id = lh.audiobook_id
                WHERE a.author = ? AND lh.audiobook_id IS NULL
                ORDER BY a.added_date DESC
                LIMIT ?
                "#,
            )
            .bind(&author)
            .bind(limit / author_count)
            .fetch_all(self.pool)
            .await
            .context("Failed to get author-based recommendations")?;

            for book in books {
                let recommendation = Recommendation::new(
                    book.id.clone(),
                    "author_preference".to_string(),
                    preference_score * 0.9, // Author preferences get higher weight
                    Some(format!("More audiobooks by {}", author)),
                );

                recommendations.push(RecommendationWithAudiobook {
                    recommendation,
                    audiobook: book,
                });
            }
        }

        Ok(recommendations)
    }

    async fn generate_similar_recommendations(&self, limit: i32) -> Result<Vec<RecommendationWithAudiobook>> {
        // Find audiobooks similar to recently completed ones
        let recently_completed = sqlx::query_as::<_, Audiobook>(
            r#"
            SELECT a.* FROM audiobooks a
            JOIN listening_history lh ON a.id = lh.audiobook_id
            WHERE lh.completion_percentage > 0.8
            ORDER BY lh.listened_at DESC
            LIMIT 3
            "#,
        )
        .fetch_all(self.pool)
        .await
        .context("Failed to get recently completed audiobooks")?;

        if recently_completed.is_empty() {
            return Ok(Vec::new());
        }

        let mut recommendations = Vec::new();
        let completed_count = recently_completed.len() as i32;
        
        for completed_book in recently_completed {
            // Find similar books by genre and author
            let similar_books = sqlx::query_as::<_, Audiobook>(
                r#"
                SELECT DISTINCT a.* FROM audiobooks a
                LEFT JOIN listening_history lh ON a.id = lh.audiobook_id
                WHERE a.id != ?
                  AND lh.audiobook_id IS NULL
                  AND (a.genre = ? OR a.author = ?)
                ORDER BY 
                  CASE 
                    WHEN a.author = ? THEN 2
                    WHEN a.genre = ? THEN 1
                    ELSE 0
                  END DESC,
                  a.added_date DESC
                LIMIT ?
                "#,
            )
            .bind(&completed_book.id)
            .bind(&completed_book.genre)
            .bind(&completed_book.author)
            .bind(&completed_book.author)
            .bind(&completed_book.genre)
            .bind(limit / completed_count)
            .fetch_all(self.pool)
            .await
            .context("Failed to get similar audiobooks")?;

            for book in similar_books {
                let score = if book.author == completed_book.author { 0.9 } else { 0.7 };
                let reason = if book.author == completed_book.author {
                    format!("More books by {} (similar to '{}')", 
                           book.author.as_ref().unwrap_or(&"Unknown".to_string()), 
                           completed_book.title)
                } else {
                    format!("Similar to '{}' (same genre)", completed_book.title)
                };

                let recommendation = Recommendation::new(
                    book.id.clone(),
                    "similar_to_completed".to_string(),
                    score,
                    Some(reason),
                );

                recommendations.push(RecommendationWithAudiobook {
                    recommendation,
                    audiobook: book,
                });
            }
        }

        Ok(recommendations)
    }

    async fn save_recommendation(&self, recommendation: &Recommendation) -> Result<()> {
        sqlx::query(
            r#"
            INSERT OR IGNORE INTO recommendations (
                id, audiobook_id, recommendation_type, recommendation_score,
                recommendation_reason, generated_at, expires_at, is_dismissed, user_feedback
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&recommendation.id)
        .bind(&recommendation.audiobook_id)
        .bind(&recommendation.recommendation_type)
        .bind(&recommendation.recommendation_score)
        .bind(&recommendation.recommendation_reason)
        .bind(&recommendation.generated_at)
        .bind(&recommendation.expires_at)
        .bind(&recommendation.is_dismissed)
        .bind(&recommendation.user_feedback)
        .execute(self.pool)
        .await
        .context("Failed to save recommendation")?;

        Ok(())
    }

    async fn update_preferences_from_session(&self, audiobook_id: &str) -> Result<()> {
        // Get audiobook details
        let audiobook = AudiobookRepository::new(self.pool)
            .find_by_id(audiobook_id)
            .await
            .context("Failed to find audiobook")?;

        if let Some(book) = audiobook {
            // Update genre preference
            if let Some(genre) = &book.genre {
                self.update_preference("genre", genre, 0.1).await?;
            }
            
            // Update author preference
            if let Some(author) = &book.author {
                self.update_preference("author", author, 0.1).await?;
            }

            // Update narrator preference
            if let Some(narrator) = &book.narrator {
                self.update_preference("narrator", narrator, 0.05).await?;
            }
        }

        Ok(())
    }

    async fn update_preference(&self, pref_type: &str, pref_value: &str, increment: f64) -> Result<()> {
        // Check if preference exists
        let existing = sqlx::query_as::<_, UserPreference>(
            "SELECT * FROM user_preferences WHERE preference_type = ? AND preference_value = ?"
        )
        .bind(pref_type)
        .bind(pref_value)
        .fetch_optional(self.pool)
        .await
        .context("Failed to check existing preference")?;

        if let Some(mut pref) = existing {
            // Update existing preference
            pref.preference_score += increment;
            pref.updated_at = Utc::now().to_rfc3339();

            sqlx::query(
                "UPDATE user_preferences SET preference_score = ?, updated_at = ? WHERE id = ?"
            )
            .bind(pref.preference_score)
            .bind(&pref.updated_at)
            .bind(&pref.id)
            .execute(self.pool)
            .await
            .context("Failed to update preference")?;
        } else {
            // Create new preference
            let pref = UserPreference::new(
                pref_type.to_string(),
                pref_value.to_string(),
                increment,
            );

            sqlx::query(
                r#"
                INSERT INTO user_preferences (
                    id, preference_type, preference_value, preference_score, updated_at, created_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                "#,
            )
            .bind(&pref.id)
            .bind(&pref.preference_type)
            .bind(&pref.preference_value)
            .bind(&pref.preference_score)
            .bind(&pref.updated_at)
            .bind(&pref.created_at)
            .execute(self.pool)
            .await
            .context("Failed to create preference")?;
        }

        Ok(())
    }

    async fn update_preferences_from_feedback(&self, feedback: &RecommendationFeedback) -> Result<()> {
        // Get recommendation details
        let recommendation = sqlx::query_as::<_, Recommendation>(
            "SELECT * FROM recommendations WHERE id = ?"
        )
        .bind(&feedback.recommendation_id)
        .fetch_optional(self.pool)
        .await
        .context("Failed to get recommendation")?;

        if let Some(rec) = recommendation {
            // Get audiobook details
            let audiobook_repo = AudiobookRepository::new(self.pool);
            if let Some(audiobook) = audiobook_repo.find_by_id(&rec.audiobook_id).await? {
                let feedback_weight = match feedback.feedback_value {
                    1 => 0.2,   // Like
                    0 => 0.0,   // Neutral
                    -1 => -0.1, // Dislike
                    _ => 0.0,
                };

                // Update preferences based on feedback
                if let Some(genre) = &audiobook.genre {
                    self.update_preference("genre", genre, feedback_weight).await?;
                }
                
                if let Some(author) = &audiobook.author {
                    self.update_preference("author", author, feedback_weight).await?;
                }
            }
        }

        Ok(())
    }

    async fn cleanup_old_recommendations(&self) -> Result<()> {
        sqlx::query("DELETE FROM recommendations WHERE expires_at IS NOT NULL AND expires_at < datetime('now')")
            .execute(self.pool)
            .await
            .context("Failed to cleanup old recommendations")?;

        Ok(())
    }
}