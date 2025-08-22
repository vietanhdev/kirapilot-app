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
            dependencies: Some(vec!["dep1".to_string(), "dep2".to_string()]),
            time_estimate: Some(60),
            due_date: Some(Utc::now()),
            scheduled_date: Some(Utc::now()),
            tags: Some(vec!["tag1".to_string(), "tag2".to_string()]),
            project_id: Some("project1".to_string()),
            parent_task_id: None,
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
            dependencies: None,
            time_estimate: None,
            due_date: None,
            scheduled_date: None,
            tags: None,
            project_id: None,
            parent_task_id: None,
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
            dependencies: None,
            time_estimate: None,
            due_date: None,
            scheduled_date: None,
            tags: None,
            project_id: None,
            parent_task_id: None,
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
            dependencies: None,
            time_estimate: Some(120),
            actual_time: Some(30),
            due_date: None,
            scheduled_date: None,
            tags: None,
            project_id: None,
            parent_task_id: None,
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
            dependencies: None,
            time_estimate: None,
            due_date: None,
            scheduled_date: None,
            tags: None,
            project_id: Some("project1".to_string()),
            parent_task_id: None,
        };

        let request2 = CreateTaskRequest {
            title: "Task 2".to_string(),
            description: None,
            priority: 2,
            status: Some("completed".to_string()),
            dependencies: None,
            time_estimate: None,
            due_date: None,
            scheduled_date: None,
            tags: None,
            project_id: Some("project1".to_string()),
            parent_task_id: None,
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
            dependencies: None,
            time_estimate: None,
            due_date: None,
            scheduled_date: None, // No scheduled date = backlog
            tags: None,
            project_id: None,
            parent_task_id: None,
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
            dependencies: None,
            time_estimate: None,
            due_date: None,
            scheduled_date: None,
            tags: None,
            project_id: None,
            parent_task_id: None,
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
            dependencies: None,
            time_estimate: None,
            due_date: None,
            scheduled_date: None,
            tags: None,
            project_id: None,
            parent_task_id: None,
        };

        let request2 = CreateTaskRequest {
            title: "Code Review".to_string(),
            description: Some("Review pull request for new feature".to_string()),
            priority: 2,
            status: None,
            dependencies: None,
            time_estimate: None,
            due_date: None,
            scheduled_date: None,
            tags: None,
            project_id: None,
            parent_task_id: None,
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
                dependencies: None,
                time_estimate: None,
                due_date: None,
                scheduled_date: None,
                tags: None,
                project_id: None,
                parent_task_id: None,
            },
            CreateTaskRequest {
                title: "In Progress Task".to_string(),
                description: None,
                priority: 1,
                status: Some("in_progress".to_string()),
                dependencies: None,
                time_estimate: None,
                due_date: None,
                scheduled_date: None,
                tags: None,
                project_id: None,
                parent_task_id: None,
            },
            CreateTaskRequest {
                title: "Completed Task".to_string(),
                description: None,
                priority: 1,
                status: Some("completed".to_string()),
                dependencies: None,
                time_estimate: None,
                due_date: None,
                scheduled_date: None,
                tags: None,
                project_id: None,
                parent_task_id: None,
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
}
