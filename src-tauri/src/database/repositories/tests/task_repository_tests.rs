#[cfg(test)]
mod tests {
    use super::super::super::tests::setup_test_db;
    use crate::database::repositories::task_repository::{
        CreateTaskRequest, TaskRepository, UpdateTaskRequest,
    };
    use chrono::Utc;

    #[tokio::test]
    async fn test_create_task() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let repo = TaskRepository::new(db);

        let request = CreateTaskRequest {
            title: "Test Task".to_string(),
            description: Some("Test Description".to_string()),
            priority: 1,
            status: Some("pending".to_string()),
            order_num: None,
            dependencies: Some(vec!["dep1".to_string(), "dep2".to_string()]),
            time_estimate: Some(60),
            due_date: Some(Utc::now()),
            scheduled_date: Some(Utc::now()),
            tags: Some(vec!["tag1".to_string(), "tag2".to_string()]),
            project_id: Some("project1".to_string()),
            parent_task_id: None,
            task_list_id: None,
        };

        let result = repo.create_task(request).await;
        assert!(result.is_ok());

        let task = result.unwrap();
        assert_eq!(task.title, "Test Task");
        assert_eq!(task.description, Some("Test Description".to_string()));
        assert_eq!(task.priority, 1);
        assert_eq!(task.status, "pending");
    }

    #[tokio::test]
    async fn test_find_by_id() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let repo = TaskRepository::new(db);

        // Create a task first
        let request = CreateTaskRequest {
            title: "Find Test Task".to_string(),
            description: None,
            priority: 2,
            status: None,
            order_num: None,
            dependencies: None,
            time_estimate: None,
            due_date: None,
            scheduled_date: None,
            tags: None,
            project_id: None,
            parent_task_id: None,
            task_list_id: None,
        };

        let created_task = repo
            .create_task(request)
            .await
            .expect("Failed to create task");

        // Find the task by ID
        let found_task = repo
            .find_by_id(&created_task.id)
            .await
            .expect("Failed to find task");

        assert!(found_task.is_some());
        let found_task = found_task.unwrap();
        assert_eq!(found_task.id, created_task.id);
        assert_eq!(found_task.title, "Find Test Task");
    }

    #[tokio::test]
    async fn test_update_task() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let repo = TaskRepository::new(db);

        // Create a task first
        let request = CreateTaskRequest {
            title: "Update Test Task".to_string(),
            description: None,
            priority: 1,
            status: None,
            order_num: None,
            dependencies: None,
            time_estimate: None,
            due_date: None,
            scheduled_date: None,
            tags: None,
            project_id: None,
            parent_task_id: None,
            task_list_id: None,
        };

        let created_task = repo
            .create_task(request)
            .await
            .expect("Failed to create task");

        // Update the task
        let update_request = UpdateTaskRequest {
            title: Some("Updated Task Title".to_string()),
            description: Some("Updated Description".to_string()),
            priority: Some(3),
            status: Some("in_progress".to_string()),
            clear_scheduled_date: None,
            order_num: None,
            dependencies: None,
            time_estimate: Some(120),
            actual_time: Some(30),
            due_date: None,
            scheduled_date: None,
            tags: None,
            project_id: None,
            parent_task_id: None,
            task_list_id: None,
            completed_at: None,
        };

        let updated_task = repo
            .update_task(&created_task.id, update_request)
            .await
            .expect("Failed to update task");

        assert_eq!(updated_task.title, "Updated Task Title");
        assert_eq!(
            updated_task.description,
            Some("Updated Description".to_string())
        );
        assert_eq!(updated_task.priority, 3);
        assert_eq!(updated_task.status, "in_progress");
        assert_eq!(updated_task.time_estimate, 120);
        assert_eq!(updated_task.actual_time, 30);
    }

    #[tokio::test]
    async fn test_find_all_with_filters() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let repo = TaskRepository::new(db);

        // Create multiple tasks
        let request1 = CreateTaskRequest {
            title: "Task 1".to_string(),
            description: None,
            priority: 1,
            status: Some("pending".to_string()),
            order_num: None,
            dependencies: None,
            time_estimate: None,
            due_date: None,
            scheduled_date: None,
            tags: None,
            project_id: Some("project1".to_string()),
            parent_task_id: None,
            task_list_id: None,
        };

        let request2 = CreateTaskRequest {
            title: "Task 2".to_string(),
            description: None,
            priority: 2,
            status: Some("completed".to_string()),
            order_num: None,
            dependencies: None,
            time_estimate: None,
            due_date: None,
            scheduled_date: None,
            tags: None,
            project_id: Some("project1".to_string()),
            parent_task_id: None,
            task_list_id: None,
        };

        repo.create_task(request1)
            .await
            .expect("Failed to create task 1");
        repo.create_task(request2)
            .await
            .expect("Failed to create task 2");

        // Find all tasks
        let all_tasks = repo
            .find_all(None, None)
            .await
            .expect("Failed to find all tasks");
        assert!(all_tasks.len() >= 2);

        // Find tasks by status
        let pending_tasks = repo
            .find_all(Some("pending"), None)
            .await
            .expect("Failed to find pending tasks");
        assert!(pending_tasks.iter().all(|t| t.status == "pending"));

        // Find tasks by project
        let project_tasks = repo
            .find_all(None, Some("project1"))
            .await
            .expect("Failed to find project tasks");
        assert!(project_tasks
            .iter()
            .all(|t| t.project_id == Some("project1".to_string())));
    }

    #[tokio::test]
    async fn test_find_backlog() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let repo = TaskRepository::new(db);

        // Create a task without scheduled date (backlog)
        let request = CreateTaskRequest {
            title: "Backlog Task".to_string(),
            description: None,
            priority: 1,
            status: Some("pending".to_string()),
            order_num: None,
            dependencies: None,
            time_estimate: None,
            due_date: None,
            scheduled_date: None, // No scheduled date = backlog
            tags: None,
            project_id: None,
            parent_task_id: None,
            task_list_id: None,
        };

        repo.create_task(request)
            .await
            .expect("Failed to create backlog task");

        let backlog_tasks = repo
            .find_backlog()
            .await
            .expect("Failed to find backlog tasks");
        assert!(!backlog_tasks.is_empty());
        assert!(backlog_tasks.iter().all(|t| t.scheduled_date.is_none()));
        assert!(backlog_tasks.iter().all(|t| t.status != "completed"));
    }

    #[tokio::test]
    async fn test_delete_task() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let repo = TaskRepository::new(db);

        // Create a task
        let request = CreateTaskRequest {
            title: "Delete Test Task".to_string(),
            description: None,
            priority: 1,
            status: None,
            order_num: None,
            dependencies: None,
            time_estimate: None,
            due_date: None,
            scheduled_date: None,
            tags: None,
            project_id: None,
            parent_task_id: None,
            task_list_id: None,
        };

        let created_task = repo
            .create_task(request)
            .await
            .expect("Failed to create task");

        // Delete the task
        repo.delete_task(&created_task.id)
            .await
            .expect("Failed to delete task");

        // Verify task is deleted
        let found_task = repo
            .find_by_id(&created_task.id)
            .await
            .expect("Failed to query task");
        assert!(found_task.is_none());
    }

    #[tokio::test]
    async fn test_search_tasks() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let repo = TaskRepository::new(db);

        // Create tasks with searchable content
        let request1 = CreateTaskRequest {
            title: "Important Meeting".to_string(),
            description: Some("Discuss project roadmap".to_string()),
            priority: 1,
            status: None,
            order_num: None,
            dependencies: None,
            time_estimate: None,
            due_date: None,
            scheduled_date: None,
            tags: None,
            project_id: None,
            parent_task_id: None,
            task_list_id: None,
        };

        let request2 = CreateTaskRequest {
            title: "Code Review".to_string(),
            description: Some("Review pull request for new feature".to_string()),
            priority: 2,
            status: None,
            order_num: None,
            dependencies: None,
            time_estimate: None,
            due_date: None,
            scheduled_date: None,
            tags: None,
            project_id: None,
            parent_task_id: None,
            task_list_id: None,
        };

        repo.create_task(request1)
            .await
            .expect("Failed to create task 1");
        repo.create_task(request2)
            .await
            .expect("Failed to create task 2");

        // Search by title
        let meeting_tasks = repo
            .search_tasks("Meeting")
            .await
            .expect("Failed to search tasks");
        assert!(!meeting_tasks.is_empty());
        assert!(meeting_tasks.iter().any(|t| t.title.contains("Meeting")));

        // Search by description
        let review_tasks = repo
            .search_tasks("Review")
            .await
            .expect("Failed to search tasks");
        assert!(!review_tasks.is_empty());
        assert!(review_tasks.iter().any(|t| t.title.contains("Review")
            || t.description
                .as_ref()
                .map_or(false, |d| d.contains("Review"))));
    }

    #[tokio::test]
    async fn test_get_task_stats() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let repo = TaskRepository::new(db);

        // Create tasks with different statuses
        let requests = vec![
            CreateTaskRequest {
                title: "Pending Task".to_string(),
                description: None,
                priority: 1,
                status: Some("pending".to_string()),
            order_num: None,
                dependencies: None,
                time_estimate: None,
                due_date: None,
                scheduled_date: None,
                tags: None,
                project_id: None,
                parent_task_id: None,
                task_list_id: None,
            },
            CreateTaskRequest {
                title: "In Progress Task".to_string(),
                description: None,
                priority: 1,
                status: Some("in_progress".to_string()),
            order_num: None,
                dependencies: None,
                time_estimate: None,
                due_date: None,
                scheduled_date: None,
                tags: None,
                project_id: None,
                parent_task_id: None,
                task_list_id: None,
            },
            CreateTaskRequest {
                title: "Completed Task".to_string(),
                description: None,
                priority: 1,
                status: Some("completed".to_string()),
            order_num: None,
                dependencies: None,
                time_estimate: None,
                due_date: None,
                scheduled_date: None,
                tags: None,
                project_id: None,
                parent_task_id: None,
                task_list_id: None,
            },
        ];

        for request in requests {
            repo.create_task(request)
                .await
                .expect("Failed to create task");
        }

        let stats = repo
            .get_task_stats()
            .await
            .expect("Failed to get task stats");
        assert!(stats.total >= 3);
        assert!(stats.pending >= 1);
        assert!(stats.in_progress >= 1);
        assert!(stats.completed >= 1);
    }

    #[tokio::test]
    async fn test_find_by_task_list() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let repo = TaskRepository::new(db.clone());

        // First, create a task list using TaskListRepository
        use crate::database::repositories::task_list_repository::TaskListRepository;
        let task_list_repo = TaskListRepository::new(db);
        
        // Ensure default task list exists
        let default_task_list = task_list_repo
            .ensure_default_task_list()
            .await
            .expect("Failed to ensure default task list");

        // Create a custom task list
        let custom_task_list = task_list_repo
            .create_task_list("Test Project".to_string())
            .await
            .expect("Failed to create custom task list");

        // Create tasks in different task lists
        let request1 = CreateTaskRequest {
            title: "Default Task".to_string(),
            description: None,
            priority: 1,
            status: Some("pending".to_string()),
            order_num: None,
            dependencies: None,
            time_estimate: None,
            due_date: None,
            scheduled_date: None,
            tags: None,
            project_id: None,
            parent_task_id: None,
            task_list_id: Some(default_task_list.id.clone()),
        };

        let request2 = CreateTaskRequest {
            title: "Custom Task".to_string(),
            description: None,
            priority: 1,
            status: Some("pending".to_string()),
            order_num: None,
            dependencies: None,
            time_estimate: None,
            due_date: None,
            scheduled_date: None,
            tags: None,
            project_id: None,
            parent_task_id: None,
            task_list_id: Some(custom_task_list.id.clone()),
        };

        repo.create_task(request1)
            .await
            .expect("Failed to create default task");
        repo.create_task(request2)
            .await
            .expect("Failed to create custom task");

        // Find tasks by default task list
        let default_tasks = repo
            .find_by_task_list(&default_task_list.id)
            .await
            .expect("Failed to find tasks by default task list");
        assert!(!default_tasks.is_empty());
        assert!(default_tasks
            .iter()
            .all(|t| t.task_list_id == Some(default_task_list.id.clone())));

        // Find tasks by custom task list
        let custom_tasks = repo
            .find_by_task_list(&custom_task_list.id)
            .await
            .expect("Failed to find tasks by custom task list");
        assert!(!custom_tasks.is_empty());
        assert!(custom_tasks
            .iter()
            .all(|t| t.task_list_id == Some(custom_task_list.id.clone())));
    }

    #[tokio::test]
    async fn test_move_task_to_list() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let repo = TaskRepository::new(db.clone());

        // Create task lists
        use crate::database::repositories::task_list_repository::TaskListRepository;
        let task_list_repo = TaskListRepository::new(db);
        
        let default_task_list = task_list_repo
            .ensure_default_task_list()
            .await
            .expect("Failed to ensure default task list");

        let custom_task_list = task_list_repo
            .create_task_list("Target Project".to_string())
            .await
            .expect("Failed to create custom task list");

        // Create a task in the default task list
        let request = CreateTaskRequest {
            title: "Movable Task".to_string(),
            description: None,
            priority: 1,
            status: Some("pending".to_string()),
            order_num: None,
            dependencies: None,
            time_estimate: None,
            due_date: None,
            scheduled_date: None,
            tags: None,
            project_id: None,
            parent_task_id: None,
            task_list_id: Some(default_task_list.id.clone()),
        };

        let created_task = repo
            .create_task(request)
            .await
            .expect("Failed to create task");

        // Verify task is in default task list
        assert_eq!(created_task.task_list_id, Some(default_task_list.id.clone()));

        // Move task to custom task list
        let moved_task = repo
            .move_task_to_list(&created_task.id, &custom_task_list.id)
            .await
            .expect("Failed to move task to custom task list");

        // Verify task is now in custom task list
        assert_eq!(moved_task.task_list_id, Some(custom_task_list.id.clone()));
        assert_eq!(moved_task.id, created_task.id);
        assert_eq!(moved_task.title, created_task.title);
    }

    #[tokio::test]
    async fn test_move_task_to_nonexistent_list() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let repo = TaskRepository::new(db.clone());

        // Create task lists
        use crate::database::repositories::task_list_repository::TaskListRepository;
        let task_list_repo = TaskListRepository::new(db);
        
        let default_task_list = task_list_repo
            .ensure_default_task_list()
            .await
            .expect("Failed to ensure default task list");

        // Create a task
        let request = CreateTaskRequest {
            title: "Test Task".to_string(),
            description: None,
            priority: 1,
            status: Some("pending".to_string()),
            order_num: None,
            dependencies: None,
            time_estimate: None,
            due_date: None,
            scheduled_date: None,
            tags: None,
            project_id: None,
            parent_task_id: None,
            task_list_id: Some(default_task_list.id),
        };

        let created_task = repo
            .create_task(request)
            .await
            .expect("Failed to create task");

        // Try to move task to non-existent task list
        let result = repo
            .move_task_to_list(&created_task.id, "non-existent-id")
            .await;

        assert!(result.is_err());
        if let Err(err) = result {
            assert!(matches!(err, sea_orm::DbErr::RecordNotFound(_)));
        }
    }

    #[tokio::test]
    async fn test_migrate_orphaned_tasks_to_default() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let repo = TaskRepository::new(db.clone());

        // Create task lists
        use crate::database::repositories::task_list_repository::TaskListRepository;
        let task_list_repo = TaskListRepository::new(db);
        
        let default_task_list = task_list_repo
            .ensure_default_task_list()
            .await
            .expect("Failed to ensure default task list");

        // Create tasks with null task_list_id (orphaned tasks)
        let request1 = CreateTaskRequest {
            title: "Orphaned Task 1".to_string(),
            description: None,
            priority: 1,
            status: Some("pending".to_string()),
            order_num: None,
            dependencies: None,
            time_estimate: None,
            due_date: None,
            scheduled_date: None,
            tags: None,
            project_id: None,
            parent_task_id: None,
            task_list_id: None, // This will be null in the database
        };

        let request2 = CreateTaskRequest {
            title: "Orphaned Task 2".to_string(),
            description: None,
            priority: 1,
            status: Some("pending".to_string()),
            order_num: None,
            dependencies: None,
            time_estimate: None,
            due_date: None,
            scheduled_date: None,
            tags: None,
            project_id: None,
            parent_task_id: None,
            task_list_id: None, // This will be null in the database
        };

        // Create the tasks - they should get the default task list ID due to our create_task logic
        // But let's manually set them to null to simulate orphaned tasks
        let task1 = repo.create_task(request1).await.expect("Failed to create task 1");
        let task2 = repo.create_task(request2).await.expect("Failed to create task 2");

        // Manually set task_list_id to null to simulate orphaned tasks
        // We'll use the update_task method to set task_list_id to None
        use crate::database::repositories::task_repository::UpdateTaskRequest;
        
        let update_request1 = UpdateTaskRequest {
            title: None,
            description: None,
            priority: None,
            status: None,
            clear_scheduled_date: None,
            order_num: None,
            dependencies: None,
            time_estimate: None,
            actual_time: None,
            due_date: None,
            scheduled_date: None,
            tags: None,
            project_id: None,
            parent_task_id: None,
            task_list_id: Some("".to_string()), // Empty string will be treated as null
            completed_at: None,
        };

        let update_request2 = UpdateTaskRequest {
            title: None,
            description: None,
            priority: None,
            status: None,
            clear_scheduled_date: None,
            order_num: None,
            dependencies: None,
            time_estimate: None,
            actual_time: None,
            due_date: None,
            scheduled_date: None,
            tags: None,
            project_id: None,
            parent_task_id: None,
            task_list_id: Some("".to_string()), // Empty string will be treated as null
            completed_at: None,
        };

        // Update tasks to set task_list_id to null
        repo.update_task(&task1.id, update_request1).await.expect("Failed to update task 1");
        repo.update_task(&task2.id, update_request2).await.expect("Failed to update task 2");

        // Migrate orphaned tasks
        let migrated_count = repo
            .migrate_orphaned_tasks_to_default()
            .await
            .expect("Failed to migrate orphaned tasks");

        assert_eq!(migrated_count, 2);

        // Verify tasks are now assigned to default task list
        let all_tasks = repo
            .find_all(None, None)
            .await
            .expect("Failed to find all tasks");
        
        let orphaned_tasks: Vec<_> = all_tasks
            .iter()
            .filter(|t| t.title.contains("Orphaned"))
            .collect();
        
        assert_eq!(orphaned_tasks.len(), 2);
        assert!(orphaned_tasks
            .iter()
            .all(|t| t.task_list_id == Some(default_task_list.id.clone())));
    }

    #[tokio::test]
    async fn test_create_task_with_task_list_id() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        let repo = TaskRepository::new(db.clone());

        // Create task lists
        use crate::database::repositories::task_list_repository::TaskListRepository;
        let task_list_repo = TaskListRepository::new(db);
        
        let default_task_list = task_list_repo
            .ensure_default_task_list()
            .await
            .expect("Failed to ensure default task list");

        let custom_task_list = task_list_repo
            .create_task_list("Custom Project".to_string())
            .await
            .expect("Failed to create custom task list");

        // Create task with specific task list ID
        let request_with_list = CreateTaskRequest {
            title: "Task with List".to_string(),
            description: None,
            priority: 1,
            status: Some("pending".to_string()),
            order_num: None,
            dependencies: None,
            time_estimate: None,
            due_date: None,
            scheduled_date: None,
            tags: None,
            project_id: None,
            parent_task_id: None,
            task_list_id: Some(custom_task_list.id.clone()),
        };

        let task_with_list = repo
            .create_task(request_with_list)
            .await
            .expect("Failed to create task with list");

        assert_eq!(task_with_list.task_list_id, Some(custom_task_list.id));

        // Create task without task list ID (should use default)
        let request_without_list = CreateTaskRequest {
            title: "Task without List".to_string(),
            description: None,
            priority: 1,
            status: Some("pending".to_string()),
            order_num: None,
            dependencies: None,
            time_estimate: None,
            due_date: None,
            scheduled_date: None,
            tags: None,
            project_id: None,
            parent_task_id: None,
            task_list_id: None,
        };

        let task_without_list = repo
            .create_task(request_without_list)
            .await
            .expect("Failed to create task without list");

        assert_eq!(task_without_list.task_list_id, Some(default_task_list.id));
    }
}
