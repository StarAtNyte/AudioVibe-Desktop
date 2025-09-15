// Database module for AudioVibe
// This module will handle SQLite database operations and data persistence

use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};
use sqlx::migrate::MigrateDatabase;
use std::path::Path;
use anyhow::{Result, Context};

pub mod models;
pub mod repository;

#[derive(Debug, Clone)]
pub struct DatabaseManager {
    pool: Option<SqlitePool>,
    database_path: String,
}

impl DatabaseManager {
    pub fn new(database_path: String) -> Self {
        Self {
            pool: None,
            database_path,
        }
    }

    pub async fn initialize(&mut self) -> Result<()> {
        log::info!("Initializing database at: {}", self.database_path);
        
        // Ensure database directory exists
        if let Some(parent) = Path::new(&self.database_path).parent() {
            tokio::fs::create_dir_all(parent).await
                .context("Failed to create database directory")?;
        }

        // Create database if it doesn't exist
        let database_url = format!("sqlite:{}", self.database_path);
        if !sqlx::Sqlite::database_exists(&database_url).await
            .context("Failed to check if database exists")? {
            sqlx::Sqlite::create_database(&database_url).await
                .context("Failed to create database")?;
            log::info!("Created new database at: {}", self.database_path);
        }

        // Create connection pool
        let pool = SqlitePoolOptions::new()
            .max_connections(10)
            .connect(&database_url).await
            .context("Failed to create database connection pool")?;

        // Run migrations
        sqlx::migrate!("./migrations")
            .run(&pool).await
            .context("Failed to run database migrations")?;

        self.pool = Some(pool);
        log::info!("Database initialized successfully");
        Ok(())
    }

    pub fn get_pool(&self) -> Result<&SqlitePool> {
        self.pool.as_ref()
            .ok_or_else(|| anyhow::anyhow!("Database not initialized"))
    }

}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_database_manager_creation() {
        let db = DatabaseManager::new("test.db".to_string());
        assert!(!db.is_initialized());
        assert_eq!(db.database_path, "test.db");
    }

    #[tokio::test]
    async fn test_database_manager_initialization() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db").to_string_lossy().to_string();
        let mut db = DatabaseManager::new(db_path);
        
        assert!(db.initialize().await.is_ok());
        assert!(db.is_initialized());
        assert!(db.get_pool().is_ok());
    }
}