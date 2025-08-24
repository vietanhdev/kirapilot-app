use crate::database::repositories::task_list_repository::TaskListRepository;
use sea_orm::DbErr;

#[cfg(test)]
mod task_list_repository_tests {
    use super::*;
    use crate::database::repositories::tests::setup_test_db;

    #[tokio::test]
    async fn test_validate_task_list_name_valid() {
        let db = setup_test_db().await.unwrap();
        let repo = TaskListRepository::new(db);

        assert!(repo.validate_task_list_name("Valid Name").is_ok());
        assert!(repo.validate_task_list_name("Project Alpha").is_ok());
        assert!(repo.validate_task_list_name("123").is_ok());
        assert!(repo
            .validate_task_list_name("Special-Characters_123")
            .is_ok());
    }

    #[tokio::test]
    async fn test_validate_task_list_name_empty() {
        let db = setup_test_db().await.unwrap();
        let repo = TaskListRepository::new(db);

        let result = repo.validate_task_list_name("");
        assert!(result.is_err());

        if let Err(DbErr::Custom(msg)) = result {
            assert!(msg.contains("Task list name cannot be empty"));
        } else {
            panic!("Expected custom error for empty name");
        }
    }

    #[tokio::test]
    async fn test_validate_task_list_name_whitespace() {
        let db = setup_test_db().await.unwrap();
        let repo = TaskListRepository::new(db);

        let result = repo.validate_task_list_name("   ");
        assert!(result.is_err());

        if let Err(DbErr::Custom(msg)) = result {
            assert!(msg.contains("Task list name cannot be empty"));
        } else {
            panic!("Expected custom error for whitespace name");
        }
    }

    #[tokio::test]
    async fn test_validate_task_list_name_reserved() {
        let db = setup_test_db().await.unwrap();
        let repo = TaskListRepository::new(db);

        let reserved_names = ["All", "ALL", "all"];
        for name in reserved_names {
            let result = repo.validate_task_list_name(name);
            assert!(result.is_err());

            if let Err(DbErr::Custom(msg)) = result {
                assert!(msg.contains("reserved name"));
            } else {
                panic!("Expected custom error for reserved name: {}", name);
            }
        }
    }

    #[tokio::test]
    async fn test_validate_task_list_name_too_long() {
        let db = setup_test_db().await.unwrap();
        let repo = TaskListRepository::new(db);

        let long_name = "a".repeat(256);
        let result = repo.validate_task_list_name(&long_name);
        assert!(result.is_err());

        if let Err(DbErr::Custom(msg)) = result {
            assert!(msg.contains("cannot exceed 255 characters"));
        } else {
            panic!("Expected custom error for long name");
        }
    }

    #[tokio::test]
    async fn test_validate_task_list_name_edge_cases() {
        let db = setup_test_db().await.unwrap();
        let repo = TaskListRepository::new(db);

        // Test exactly 255 characters (should be valid)
        let max_valid_name = "a".repeat(255);
        assert!(repo.validate_task_list_name(&max_valid_name).is_ok());

        // Test name with only whitespace
        assert!(repo.validate_task_list_name("   \t\n   ").is_err());

        // Test name that trims to valid
        assert!(repo.validate_task_list_name("  Valid Name  ").is_ok());
    }

    #[tokio::test]
    async fn test_create_task_list_success() {
        let db = setup_test_db().await.unwrap();
        let repo = TaskListRepository::new(db);

        let result = repo.create_task_list("Test List".to_string()).await;
        assert!(result.is_ok());

        let task_list = result.unwrap();
        assert_eq!(task_list.name, "Test List");
        assert!(!task_list.is_default);
    }

    #[tokio::test]
    async fn test_create_task_list_invalid_name() {
        let db = setup_test_db().await.unwrap();
        let repo = TaskListRepository::new(db);

        let result = repo.create_task_list("".to_string()).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_ensure_default_task_list() {
        let db = setup_test_db().await.unwrap();
        let repo = TaskListRepository::new(db);

        let result = repo.ensure_default_task_list().await;
        assert!(result.is_ok());

        let default_list = result.unwrap();
        assert_eq!(default_list.name, "Default");
        assert!(default_list.is_default);
    }

    #[tokio::test]
    async fn test_find_all_task_lists() {
        let db = setup_test_db().await.unwrap();
        let repo = TaskListRepository::new(db);

        // Create a default task list first
        let _default = repo.ensure_default_task_list().await.unwrap();

        // Create a regular task list
        let _regular = repo
            .create_task_list("Project A".to_string())
            .await
            .unwrap();

        let result = repo.find_all_task_lists().await;
        assert!(result.is_ok());

        let lists = result.unwrap();
        assert!(lists.len() >= 2);

        // Check that we have both default and regular lists
        let has_default = lists.iter().any(|l| l.is_default);
        let has_regular = lists.iter().any(|l| !l.is_default);
        assert!(has_default);
        assert!(has_regular);
    }

    #[tokio::test]
    async fn test_find_by_id() {
        let db = setup_test_db().await.unwrap();
        let repo = TaskListRepository::new(db);

        let created = repo
            .create_task_list("Test List".to_string())
            .await
            .unwrap();

        let result = repo.find_by_id(&created.id).await;
        assert!(result.is_ok());

        let found = result.unwrap();
        assert!(found.is_some());
        assert_eq!(found.unwrap().name, "Test List");
    }

    #[tokio::test]
    async fn test_find_by_id_not_found() {
        let db = setup_test_db().await.unwrap();
        let repo = TaskListRepository::new(db);

        let result = repo.find_by_id("nonexistent-id").await;
        assert!(result.is_ok());

        let found = result.unwrap();
        assert!(found.is_none());
    }

    #[tokio::test]
    async fn test_update_task_list() {
        let db = setup_test_db().await.unwrap();
        let repo = TaskListRepository::new(db);

        let created = repo.create_task_list("Old Name".to_string()).await.unwrap();

        let result = repo
            .update_task_list(&created.id, "New Name".to_string())
            .await;
        assert!(result.is_ok());

        let updated = result.unwrap();
        assert_eq!(updated.name, "New Name");
    }

    #[tokio::test]
    async fn test_update_default_task_list_forbidden() {
        let db = setup_test_db().await.unwrap();
        let repo = TaskListRepository::new(db);

        let default = repo.ensure_default_task_list().await.unwrap();

        let result = repo
            .update_task_list(&default.id, "New Name".to_string())
            .await;
        assert!(result.is_err());

        if let Err(DbErr::Custom(msg)) = result {
            assert!(msg.contains("Cannot update the default task list name"));
        } else {
            panic!("Expected custom error for updating default task list");
        }
    }

    #[tokio::test]
    async fn test_delete_task_list() {
        let db = setup_test_db().await.unwrap();
        let repo = TaskListRepository::new(db);

        // Ensure default exists
        let _default = repo.ensure_default_task_list().await.unwrap();

        let created = repo
            .create_task_list("To Delete".to_string())
            .await
            .unwrap();

        let result = repo.delete_task_list(&created.id).await;
        if let Err(e) = &result {
            println!("Delete error: {:?}", e);
        }
        assert!(result.is_ok());

        // Verify it's deleted
        let found = repo.find_by_id(&created.id).await.unwrap();
        assert!(found.is_none());
    }

    #[tokio::test]
    async fn test_delete_default_task_list_forbidden() {
        let db = setup_test_db().await.unwrap();
        let repo = TaskListRepository::new(db);

        let default = repo.ensure_default_task_list().await.unwrap();

        let result = repo.delete_task_list(&default.id).await;
        assert!(result.is_err());

        if let Err(DbErr::Custom(msg)) = result {
            assert!(msg.contains("Cannot delete the default task list"));
        } else {
            panic!("Expected custom error for deleting default task list");
        }
    }

    #[tokio::test]
    async fn test_exists() {
        let db = setup_test_db().await.unwrap();
        let repo = TaskListRepository::new(db);

        let created = repo
            .create_task_list("Test List".to_string())
            .await
            .unwrap();

        let exists = repo.exists(&created.id).await.unwrap();
        assert!(exists);

        let not_exists = repo.exists("nonexistent-id").await.unwrap();
        assert!(!not_exists);
    }

    #[tokio::test]
    async fn test_get_task_list_stats() {
        let db = setup_test_db().await.unwrap();
        let repo = TaskListRepository::new(db);

        // Create some task lists
        let _default = repo.ensure_default_task_list().await.unwrap();
        let _list1 = repo.create_task_list("List 1".to_string()).await.unwrap();
        let _list2 = repo.create_task_list("List 2".to_string()).await.unwrap();

        let result = repo.get_task_list_stats().await;
        if let Err(e) = &result {
            println!("Stats error: {:?}", e);
        }
        assert!(result.is_ok());

        let stats = result.unwrap();
        assert!(stats.total_lists >= 3);
    }
}
