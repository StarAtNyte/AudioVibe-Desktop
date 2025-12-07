use serde::{Deserialize, Serialize};
use chrono::Utc;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Audiobook {
    pub id: String,
    pub title: String,
    pub author: Option<String>,
    pub narrator: Option<String>,
    pub duration: Option<i64>, // Duration in seconds
    pub file_path: String,
    pub cover_image_path: Option<String>,
    pub description: Option<String>,
    pub genre: Option<String>,
    pub publish_date: Option<String>,
    pub added_date: String,
    pub file_size: Option<i64>,
    pub bitrate: Option<i32>,
    pub sample_rate: Option<i32>,
    pub chapters_count: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Chapter {
    pub id: String,
    pub audiobook_id: String,
    pub chapter_number: i32,
    pub title: String,
    pub file_path: String,
    pub duration: Option<i64>, // Duration in seconds
    pub file_size: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
}

impl Chapter {
    pub fn new(audiobook_id: String, chapter_number: i32, title: String, file_path: String) -> Self {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        
        Self {
            id,
            audiobook_id,
            chapter_number,
            title,
            file_path,
            duration: None,
            file_size: None,
            created_at: now.clone(),
            updated_at: now,
        }
    }
}

impl Audiobook {
    pub fn new(title: String, file_path: String) -> Self {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        
        Self {
            id,
            title,
            author: None,
            narrator: None,
            duration: None,
            file_path,
            cover_image_path: None,
            description: None,
            genre: None,
            publish_date: None,
            added_date: now.clone(),
            file_size: None,
            bitrate: None,
            sample_rate: None,
            chapters_count: 0,
            created_at: now.clone(),
            updated_at: now,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PlaybackProgress {
    pub id: String,
    pub audiobook_id: String,
    pub position: i64, // Position in seconds
    pub duration: Option<i64>, // Total duration in seconds
    pub chapter_index: i32,
    pub playback_speed: f64,
    pub last_played_at: String,
    pub is_completed: bool,
    pub created_at: String,
    pub updated_at: String,
}

impl PlaybackProgress {
    pub fn new(audiobook_id: String) -> Self {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        
        Self {
            id,
            audiobook_id,
            position: 0,
            duration: None,
            chapter_index: 0,
            playback_speed: 1.0,
            last_played_at: now.clone(),
            is_completed: false,
            created_at: now.clone(),
            updated_at: now,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Collection {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub color: String,
    pub is_smart: bool,
    pub smart_criteria: Option<String>, // JSON string for smart collection rules
    pub created_at: String,
    pub updated_at: String,
}

impl Collection {
    pub fn new(name: String) -> Self {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        
        Self {
            id,
            name,
            description: None,
            color: "#3B82F6".to_string(), // Default blue color
            is_smart: false,
            smart_criteria: None,
            created_at: now.clone(),
            updated_at: now,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CollectionAudiobook {
    pub id: String,
    pub collection_id: String,
    pub audiobook_id: String,
    pub added_at: String,
    pub sort_order: i32,
}

impl CollectionAudiobook {
    #[allow(dead_code)]
    pub fn new(collection_id: String, audiobook_id: String) -> Self {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        
        Self {
            id,
            collection_id,
            audiobook_id,
            added_at: now,
            sort_order: 0,
        }
    }
}

// DTOs for API communication
#[derive(Debug, Serialize, Deserialize)]
pub struct CreateAudiobookDto {
    pub title: String,
    pub file_path: String,
    pub author: Option<String>,
    pub narrator: Option<String>,
    pub description: Option<String>,
    pub genre: Option<String>,
    pub duration: Option<i64>,
    pub cover_image_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdatePlaybackProgressDto {
    pub position: i64,
    pub chapter_index: Option<i32>,
    pub playback_speed: Option<f64>,
    pub is_completed: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateCollectionDto {
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchFilters {
    pub query: Option<String>,
    pub author: Option<String>,
    pub genre: Option<String>,
    pub narrator: Option<String>,
    pub min_duration: Option<i64>,
    pub max_duration: Option<i64>,
    pub added_after: Option<String>,
    pub added_before: Option<String>,
}

// Recommendation system models
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ListeningHistory {
    pub id: String,
    pub audiobook_id: String,
    pub listened_at: String,
    pub position_seconds: i64,
    pub duration_seconds: Option<i64>,
    pub completion_percentage: f64,
    pub session_duration: i64,
    pub playback_speed: f64,
    pub created_at: String,
}

impl ListeningHistory {
    pub fn new(audiobook_id: String, position_seconds: i64, session_duration: i64) -> Self {
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        
        Self {
            id,
            audiobook_id,
            listened_at: now.clone(),
            position_seconds,
            duration_seconds: None,
            completion_percentage: 0.0,
            session_duration,
            playback_speed: 1.0,
            created_at: now,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserPreference {
    pub id: String,
    pub preference_type: String,
    pub preference_value: String,
    pub preference_score: f64,
    pub updated_at: String,
    pub created_at: String,
}

impl UserPreference {
    pub fn new(preference_type: String, preference_value: String, preference_score: f64) -> Self {
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        
        Self {
            id,
            preference_type,
            preference_value,
            preference_score,
            updated_at: now.clone(),
            created_at: now,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Recommendation {
    pub id: String,
    pub audiobook_id: String,
    pub recommendation_type: String,
    pub recommendation_score: f64,
    pub recommendation_reason: Option<String>,
    pub generated_at: String,
    pub expires_at: Option<String>,
    pub is_dismissed: bool,
    pub user_feedback: Option<i32>,
}

impl Recommendation {
    pub fn new(
        audiobook_id: String,
        recommendation_type: String,
        recommendation_score: f64,
        recommendation_reason: Option<String>
    ) -> Self {
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        
        // Set expiration to 7 days from now
        let expires_at = chrono::Utc::now()
            .checked_add_signed(chrono::Duration::days(7))
            .map(|dt| dt.to_rfc3339());
        
        Self {
            id,
            audiobook_id,
            recommendation_type,
            recommendation_score,
            recommendation_reason,
            generated_at: now,
            expires_at,
            is_dismissed: false,
            user_feedback: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct RecommendationFeedback {
    pub id: String,
    pub recommendation_id: String,
    pub feedback_type: String,
    pub feedback_value: i32,
    pub feedback_reason: Option<String>,
    pub created_at: String,
}

impl RecommendationFeedback {
    pub fn new(
        recommendation_id: String,
        feedback_type: String,
        feedback_value: i32,
        feedback_reason: Option<String>
    ) -> Self {
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        
        Self {
            id,
            recommendation_id,
            feedback_type,
            feedback_value,
            feedback_reason,
            created_at: now,
        }
    }
}

// DTOs for the recommendation system
#[derive(Debug, Serialize, Deserialize)]
pub struct CreateListeningHistoryDto {
    pub audiobook_id: String,
    pub position_seconds: i64,
    pub duration_seconds: Option<i64>,
    pub session_duration: i64,
    pub playback_speed: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateRecommendationFeedbackDto {
    pub recommendation_id: String,
    pub feedback_type: String,
    pub feedback_value: i32,
    pub feedback_reason: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RecommendationWithAudiobook {
    pub recommendation: Recommendation,
    pub audiobook: Audiobook,
}

// Chapter DTOs
#[derive(Debug, Serialize, Deserialize)]
pub struct CreateChapterDto {
    pub audiobook_id: String,
    pub chapter_number: i32,
    pub title: String,
    pub file_path: String,
    pub duration: Option<i64>,
    pub file_size: Option<i64>,
}

// ============= EBOOK MODELS =============

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Ebook {
    pub id: String,
    pub title: String,
    pub author: Option<String>,
    pub file_path: String,
    pub file_format: String, // 'pdf' or 'epub'
    pub cover_path: Option<String>,
    pub total_pages: Option<i32>,
    pub file_size: Option<i64>,
    pub language: Option<String>,
    pub publisher: Option<String>,
    pub publication_date: Option<String>,
    pub description: Option<String>,
    pub genre: Option<String>,
    pub added_date: String,
    pub modified_date: String,
    pub created_at: String,
    pub updated_at: String,
}

impl Ebook {
    pub fn new(title: String, file_path: String, file_format: String) -> Self {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        Self {
            id,
            title,
            author: None,
            file_path,
            file_format,
            cover_path: None,
            total_pages: None,
            file_size: None,
            language: None,
            publisher: None,
            publication_date: None,
            description: None,
            genre: None,
            added_date: now.clone(),
            modified_date: now.clone(),
            created_at: now.clone(),
            updated_at: now,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ReadingProgress {
    pub id: String,
    pub ebook_id: String,
    pub current_page: Option<i32>,
    pub current_cfi: Option<String>,
    pub current_chapter_href: Option<String>,
    pub percentage_complete: f64,
    pub reading_time_seconds: i64,
    pub last_read_date: String,
    pub created_at: String,
    pub updated_at: String,
}

impl ReadingProgress {
    pub fn new(ebook_id: String) -> Self {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        Self {
            id,
            ebook_id,
            current_page: None,
            current_cfi: None,
            current_chapter_href: None,
            percentage_complete: 0.0,
            reading_time_seconds: 0,
            last_read_date: now.clone(),
            created_at: now.clone(),
            updated_at: now,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct EbookBookmark {
    pub id: String,
    pub ebook_id: String,
    pub page_number: Option<i32>,
    pub cfi: Option<String>,
    pub chapter_title: Option<String>,
    pub note: Option<String>,
    pub created_date: String,
    pub created_at: String,
    pub updated_at: String,
}

impl EbookBookmark {
    pub fn new(ebook_id: String) -> Self {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        Self {
            id,
            ebook_id,
            page_number: None,
            cfi: None,
            chapter_title: None,
            note: None,
            created_date: now.clone(),
            created_at: now.clone(),
            updated_at: now,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct EbookAnnotation {
    pub id: String,
    pub ebook_id: String,
    pub annotation_type: String, // 'highlight', 'underline', 'note'
    pub color: Option<String>,
    pub cfi_range: Option<String>,
    pub position_data: Option<String>,
    pub selected_text: Option<String>,
    pub note: Option<String>,
    pub created_date: String,
    pub created_at: String,
    pub updated_at: String,
}

impl EbookAnnotation {
    pub fn new(ebook_id: String, annotation_type: String) -> Self {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        Self {
            id,
            ebook_id,
            annotation_type,
            color: None,
            cfi_range: None,
            position_data: None,
            selected_text: None,
            note: None,
            created_date: now.clone(),
            created_at: now.clone(),
            updated_at: now,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct EbookReaderSettings {
    pub ebook_id: String,
    pub font_family: String,
    pub font_size: i32,
    pub line_height: f64,
    pub letter_spacing: f64,
    pub text_align: String,
    pub theme: String,
    pub background_color: Option<String>,
    pub text_color: Option<String>,
    pub flow_mode: String,
    pub created_at: String,
    pub updated_at: String,
}

impl EbookReaderSettings {
    pub fn new(ebook_id: String) -> Self {
        let now = Utc::now().to_rfc3339();

        Self {
            ebook_id,
            font_family: "serif".to_string(),
            font_size: 18,
            line_height: 1.6,
            letter_spacing: 0.0,
            text_align: "left".to_string(),
            theme: "light".to_string(),
            background_color: None,
            text_color: None,
            flow_mode: "paginated".to_string(),
            created_at: now.clone(),
            updated_at: now,
        }
    }
}

// Ebook DTOs
#[derive(Debug, Serialize, Deserialize)]
pub struct CreateEbookDto {
    pub title: String,
    pub file_path: String,
    pub file_format: String,
    pub author: Option<String>,
    pub description: Option<String>,
    pub genre: Option<String>,
    pub language: Option<String>,
    pub publisher: Option<String>,
    pub publication_date: Option<String>,
    pub total_pages: Option<i32>,
    pub file_size: Option<i64>,
    pub cover_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateEbookDto {
    pub title: Option<String>,
    pub author: Option<String>,
    pub description: Option<String>,
    pub genre: Option<String>,
    pub cover_path: Option<String>,
    pub publisher: Option<String>,
    pub publication_date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateReadingProgressDto {
    pub current_page: Option<i32>,
    pub current_cfi: Option<String>,
    pub current_chapter_href: Option<String>,
    pub percentage_complete: Option<f64>,
    pub reading_time_seconds: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateBookmarkDto {
    pub ebook_id: String,
    pub page_number: Option<i32>,
    pub cfi: Option<String>,
    pub chapter_title: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateAnnotationDto {
    pub ebook_id: String,
    pub annotation_type: String,
    pub color: Option<String>,
    pub cfi_range: Option<String>,
    pub position_data: Option<String>,
    pub selected_text: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateReaderSettingsDto {
    pub font_family: Option<String>,
    pub font_size: Option<i32>,
    pub line_height: Option<f64>,
    pub letter_spacing: Option<f64>,
    pub text_align: Option<String>,
    pub theme: Option<String>,
    pub background_color: Option<String>,
    pub text_color: Option<String>,
    pub flow_mode: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EbookMetadata {
    pub title: Option<String>,
    pub author: Option<String>,
    pub publisher: Option<String>,
    pub language: Option<String>,
    pub publication_date: Option<String>,
    pub total_pages: Option<i32>,
    pub cover_image: Option<String>, // base64 encoded
    pub description: Option<String>,
}

