#[cfg(test)]
mod tests {
    use super::super::super::tests::setup_test_db;
    use crate::database::repositories::pattern_repository::{
        CreatePatternRequest, PatternRepository, UpdatePatternRequest,
    };

    #[tokio::test]
    async fn test_create_pattern() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let repo = PatternRepository::new(db);

        let request = CreatePatternRequest {
            user_id: "user123".to_string(),
            pattern_type: "hourly".to_string(),
            time_slot: "09:00-10:00".to_string(),
            productivity_score: 8.5,
            confidence_level: 0.85,
            sample_size: 10,
        };

        let result = repo.create_pattern(request).await;
        assert!(result.is_ok());

        let pattern = result.unwrap();
        assert_eq!(pattern.user_id, "user123");
        assert_eq!(pattern.pattern_type, "hourly");
        assert_eq!(pattern.time_slot, "09:00-10:00");
        assert_eq!(pattern.productivity_score, 8.5);
        assert_eq!(pattern.confidence_level, 0.85);
        assert_eq!(pattern.sample_size, 10);
    }

    #[tokio::test]
    async fn test_find_patterns_for_user() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let repo = PatternRepository::new(db);

        let user_id = "user456";

        // Create multiple patterns for the user
        let patterns = vec![
            CreatePatternRequest {
                user_id: user_id.to_string(),
                pattern_type: "hourly".to_string(),
                time_slot: "09:00-10:00".to_string(),
                productivity_score: 8.5,
                confidence_level: 0.85,
                sample_size: 10,
            },
            CreatePatternRequest {
                user_id: user_id.to_string(),
                pattern_type: "daily".to_string(),
                time_slot: "Monday".to_string(),
                productivity_score: 7.8,
                confidence_level: 0.75,
                sample_size: 15,
            },
            CreatePatternRequest {
                user_id: user_id.to_string(),
                pattern_type: "session_length".to_string(),
                time_slot: "25".to_string(),
                productivity_score: 9.2,
                confidence_level: 0.90,
                sample_size: 20,
            },
        ];

        for pattern in patterns {
            repo.create_pattern(pattern)
                .await
                .expect("Failed to create pattern");
        }

        let user_patterns = repo
            .find_patterns_for_user(user_id)
            .await
            .expect("Failed to find patterns for user");
        assert_eq!(user_patterns.len(), 3);
        assert!(user_patterns.iter().all(|p| p.user_id == user_id));
    }

    #[tokio::test]
    async fn test_find_by_pattern_type() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let repo = PatternRepository::new(db);

        let user_id = "user789";

        // Create patterns of different types
        let hourly_patterns = vec![
            CreatePatternRequest {
                user_id: user_id.to_string(),
                pattern_type: "hourly".to_string(),
                time_slot: "09:00-10:00".to_string(),
                productivity_score: 8.5,
                confidence_level: 0.85,
                sample_size: 10,
            },
            CreatePatternRequest {
                user_id: user_id.to_string(),
                pattern_type: "hourly".to_string(),
                time_slot: "14:00-15:00".to_string(),
                productivity_score: 7.2,
                confidence_level: 0.72,
                sample_size: 8,
            },
        ];

        let daily_pattern = CreatePatternRequest {
            user_id: user_id.to_string(),
            pattern_type: "daily".to_string(),
            time_slot: "Tuesday".to_string(),
            productivity_score: 8.0,
            confidence_level: 0.80,
            sample_size: 12,
        };

        for pattern in hourly_patterns {
            repo.create_pattern(pattern)
                .await
                .expect("Failed to create hourly pattern");
        }
        repo.create_pattern(daily_pattern)
            .await
            .expect("Failed to create daily pattern");

        let hourly_results = repo
            .find_by_pattern_type(user_id, "hourly")
            .await
            .expect("Failed to find hourly patterns");
        assert_eq!(hourly_results.len(), 2);
        assert!(hourly_results.iter().all(|p| p.pattern_type == "hourly"));

        let daily_results = repo
            .find_by_pattern_type(user_id, "daily")
            .await
            .expect("Failed to find daily patterns");
        assert_eq!(daily_results.len(), 1);
        assert!(daily_results.iter().all(|p| p.pattern_type == "daily"));
    }

    #[tokio::test]
    async fn test_find_high_confidence_patterns() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let repo = PatternRepository::new(db);

        let user_id = "user101";

        // Create patterns with different confidence levels
        let patterns = vec![
            CreatePatternRequest {
                user_id: user_id.to_string(),
                pattern_type: "hourly".to_string(),
                time_slot: "09:00-10:00".to_string(),
                productivity_score: 8.5,
                confidence_level: 0.95, // High confidence
                sample_size: 20,
            },
            CreatePatternRequest {
                user_id: user_id.to_string(),
                pattern_type: "hourly".to_string(),
                time_slot: "14:00-15:00".to_string(),
                productivity_score: 7.2,
                confidence_level: 0.60, // Low confidence
                sample_size: 5,
            },
            CreatePatternRequest {
                user_id: user_id.to_string(),
                pattern_type: "daily".to_string(),
                time_slot: "Wednesday".to_string(),
                productivity_score: 8.8,
                confidence_level: 0.85, // High confidence
                sample_size: 15,
            },
        ];

        for pattern in patterns {
            repo.create_pattern(pattern)
                .await
                .expect("Failed to create pattern");
        }

        let high_confidence_patterns = repo
            .find_high_confidence_patterns(user_id, 0.8)
            .await
            .expect("Failed to find high confidence patterns");
        assert_eq!(high_confidence_patterns.len(), 2);
        assert!(high_confidence_patterns
            .iter()
            .all(|p| p.confidence_level >= 0.8));
    }

    #[tokio::test]
    async fn test_update_pattern() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let repo = PatternRepository::new(db);

        let request = CreatePatternRequest {
            user_id: "user202".to_string(),
            pattern_type: "hourly".to_string(),
            time_slot: "10:00-11:00".to_string(),
            productivity_score: 7.0,
            confidence_level: 0.70,
            sample_size: 5,
        };

        let created_pattern = repo
            .create_pattern(request)
            .await
            .expect("Failed to create pattern");

        let update_request = UpdatePatternRequest {
            productivity_score: Some(8.2),
            confidence_level: Some(0.82),
            sample_size: Some(12),
        };

        let updated_pattern = repo
            .update_pattern(&created_pattern.id, update_request)
            .await
            .expect("Failed to update pattern");

        assert_eq!(updated_pattern.productivity_score, 8.2);
        assert_eq!(updated_pattern.confidence_level, 0.82);
        assert_eq!(updated_pattern.sample_size, 12);
        assert!(updated_pattern.updated_at > created_pattern.updated_at);
    }

    #[tokio::test]
    async fn test_upsert_pattern() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let repo = PatternRepository::new(db);

        let user_id = "user303";
        let pattern_type = "hourly";
        let time_slot = "11:00-12:00";

        // First upsert - should create new pattern
        let request1 = CreatePatternRequest {
            user_id: user_id.to_string(),
            pattern_type: pattern_type.to_string(),
            time_slot: time_slot.to_string(),
            productivity_score: 7.5,
            confidence_level: 0.75,
            sample_size: 8,
        };

        let pattern1 = repo
            .upsert_pattern(request1)
            .await
            .expect("Failed to upsert pattern");
        assert_eq!(pattern1.productivity_score, 7.5);
        assert_eq!(pattern1.sample_size, 8);

        // Second upsert - should update existing pattern
        let request2 = CreatePatternRequest {
            user_id: user_id.to_string(),
            pattern_type: pattern_type.to_string(),
            time_slot: time_slot.to_string(),
            productivity_score: 8.5,
            confidence_level: 0.85,
            sample_size: 12,
        };

        let pattern2 = repo
            .upsert_pattern(request2)
            .await
            .expect("Failed to upsert pattern");
        assert_eq!(pattern2.id, pattern1.id); // Same pattern updated
        assert_eq!(pattern2.sample_size, 20); // 8 + 12

        // Weighted average: (7.5 * 8 + 8.5 * 12) / 20 = (60 + 102) / 20 = 8.1
        assert!((pattern2.productivity_score - 8.1).abs() < 0.01);
    }

    #[tokio::test]
    async fn test_get_productivity_insights() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let repo = PatternRepository::new(db);

        let user_id = "user404";

        // Create comprehensive patterns for insights
        let patterns = vec![
            // Hourly patterns
            CreatePatternRequest {
                user_id: user_id.to_string(),
                pattern_type: "hourly".to_string(),
                time_slot: "09:00-10:00".to_string(),
                productivity_score: 9.2,
                confidence_level: 0.92,
                sample_size: 25,
            },
            CreatePatternRequest {
                user_id: user_id.to_string(),
                pattern_type: "hourly".to_string(),
                time_slot: "14:00-15:00".to_string(),
                productivity_score: 6.5,
                confidence_level: 0.75,
                sample_size: 15,
            },
            // Daily patterns
            CreatePatternRequest {
                user_id: user_id.to_string(),
                pattern_type: "daily".to_string(),
                time_slot: "Monday".to_string(),
                productivity_score: 8.8,
                confidence_level: 0.88,
                sample_size: 20,
            },
            CreatePatternRequest {
                user_id: user_id.to_string(),
                pattern_type: "daily".to_string(),
                time_slot: "Friday".to_string(),
                productivity_score: 7.2,
                confidence_level: 0.72,
                sample_size: 18,
            },
            // Session length pattern
            CreatePatternRequest {
                user_id: user_id.to_string(),
                pattern_type: "session_length".to_string(),
                time_slot: "25".to_string(),
                productivity_score: 9.0,
                confidence_level: 0.90,
                sample_size: 30,
            },
        ];

        for pattern in patterns {
            repo.create_pattern(pattern)
                .await
                .expect("Failed to create pattern");
        }

        let insights = repo
            .get_productivity_insights(user_id)
            .await
            .expect("Failed to get productivity insights");

        assert!(!insights.most_productive_hours.is_empty());
        assert!(insights
            .most_productive_hours
            .contains(&"09:00-10:00".to_string()));

        assert!(!insights.best_days_of_week.is_empty());
        assert!(insights.best_days_of_week.contains(&"Monday".to_string()));

        assert_eq!(insights.optimal_session_length, Some(25));

        assert!(!insights.focus_patterns.is_empty());
        assert!(!insights.recommendations.is_empty());
    }

    #[tokio::test]
    async fn test_get_pattern_stats() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let repo = PatternRepository::new(db);

        let user_id = "user505";

        // Create patterns with different types and confidence levels
        let patterns = vec![
            CreatePatternRequest {
                user_id: user_id.to_string(),
                pattern_type: "hourly".to_string(),
                time_slot: "09:00-10:00".to_string(),
                productivity_score: 8.5,
                confidence_level: 0.85,
                sample_size: 10,
            },
            CreatePatternRequest {
                user_id: user_id.to_string(),
                pattern_type: "hourly".to_string(),
                time_slot: "14:00-15:00".to_string(),
                productivity_score: 7.2,
                confidence_level: 0.60,
                sample_size: 5,
            },
            CreatePatternRequest {
                user_id: user_id.to_string(),
                pattern_type: "daily".to_string(),
                time_slot: "Monday".to_string(),
                productivity_score: 9.0,
                confidence_level: 0.90,
                sample_size: 15,
            },
        ];

        for pattern in patterns {
            repo.create_pattern(pattern)
                .await
                .expect("Failed to create pattern");
        }

        let stats = repo
            .get_pattern_stats(user_id)
            .await
            .expect("Failed to get pattern stats");

        assert_eq!(stats.total_patterns, 3);
        assert_eq!(stats.high_confidence_patterns, 2); // confidence >= 0.8

        let expected_avg = (8.5 + 7.2 + 9.0) / 3.0;
        assert!((stats.average_productivity_score - expected_avg).abs() < 0.01);

        assert_eq!(stats.patterns_by_type.get("hourly"), Some(&2));
        assert_eq!(stats.patterns_by_type.get("daily"), Some(&1));
    }

    #[tokio::test]
    async fn test_delete_pattern() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let repo = PatternRepository::new(db);

        let request = CreatePatternRequest {
            user_id: "user606".to_string(),
            pattern_type: "hourly".to_string(),
            time_slot: "10:00-11:00".to_string(),
            productivity_score: 8.0,
            confidence_level: 0.80,
            sample_size: 10,
        };

        let created_pattern = repo
            .create_pattern(request)
            .await
            .expect("Failed to create pattern");

        // Delete the pattern
        repo.delete_pattern(&created_pattern.id)
            .await
            .expect("Failed to delete pattern");

        // Verify pattern is deleted
        let found_pattern = repo
            .find_by_id(&created_pattern.id)
            .await
            .expect("Failed to query pattern");
        assert!(found_pattern.is_none());
    }

    #[tokio::test]
    async fn test_delete_user_patterns() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let repo = PatternRepository::new(db);

        let user_id = "user707";

        // Create multiple patterns for the user
        for i in 0..3 {
            let request = CreatePatternRequest {
                user_id: user_id.to_string(),
                pattern_type: "hourly".to_string(),
                time_slot: format!("{:02}:00-{:02}:00", 9 + i, 10 + i),
                productivity_score: 8.0,
                confidence_level: 0.80,
                sample_size: 10,
            };
            repo.create_pattern(request)
                .await
                .expect("Failed to create pattern");
        }

        // Verify patterns exist
        let patterns_before = repo
            .find_patterns_for_user(user_id)
            .await
            .expect("Failed to find patterns");
        assert_eq!(patterns_before.len(), 3);

        // Delete all user patterns
        repo.delete_user_patterns(user_id)
            .await
            .expect("Failed to delete user patterns");

        // Verify all patterns are deleted
        let patterns_after = repo
            .find_patterns_for_user(user_id)
            .await
            .expect("Failed to find patterns");
        assert_eq!(patterns_after.len(), 0);
    }
}
