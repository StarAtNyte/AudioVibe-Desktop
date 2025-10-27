// Services module for AudioVibe
// This module will handle external services like AI conversion, cloud sync, etc.

pub mod recommendation_service;

use serde::{Deserialize, Serialize};
pub use recommendation_service::RecommendationService;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ServiceManager {
    pub ai_service_enabled: bool,
    pub sync_service_enabled: bool,
}

impl ServiceManager {
    pub fn new() -> Self {
        Self {
            ai_service_enabled: false,
            sync_service_enabled: false,
        }
    }

    #[allow(dead_code)]
    pub fn initialize_ai_service(&mut self) -> Result<(), &'static str> {
        self.ai_service_enabled = true;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn initialize_sync_service(&mut self) -> Result<(), &'static str> {
        self.sync_service_enabled = true;
        Ok(())
    }
}

impl Default for ServiceManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_service_manager_creation() {
        let manager = ServiceManager::new();
        assert!(!manager.ai_service_enabled);
        assert!(!manager.sync_service_enabled);
    }

    #[test]
    fn test_ai_service_initialization() {
        let mut manager = ServiceManager::new();
        assert!(manager.initialize_ai_service().is_ok());
        assert!(manager.ai_service_enabled);
    }

    #[test]
    fn test_sync_service_initialization() {
        let mut manager = ServiceManager::new();
        assert!(manager.initialize_sync_service().is_ok());
        assert!(manager.sync_service_enabled);
    }
}