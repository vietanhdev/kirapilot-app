#[cfg(test)]
mod task_generation_engine_tests {
    use crate::database::repositories::tests::setup_test_db;
    use crate::database::repositories::periodic_task_repository::{
        CreatePeriodicTaskTemplateRequest, PeriodicTaskRepository,
    };
    use crate::database::services::TaskGenerationEngine;
    use chrono::{Duration, Utc};

    #[tokio::test]
    async fn test_generate_pending_instances() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        
        let periodic_repo = PeriodicTaskRepository::new(db.clone());
        let engine = TaskGenerationEngine::new(db);

        // Create a periodic task template that should generate an instance
        let past_date = Utc::now() - Duration::hours(1);
        let request = CreatePeriodicTaskTemplateRequest {
            title: "Daily Test Task".to_string(),
            description: Some("Test periodic task".to_string()),
            priority: 1,
            time_estimate: 30,
            tags: Some(vec!["test".to_string()]),
            task_list_id: None,
            recurrence_type: "daily".to_string(),
            recurrence_interval: 1,
            recurrence_unit: None,
            start_date: past_date,
        };

        let template = periodic_repo
            .create_template(request)
            .await
            .expect("Failed to create template");

        // Generate pending instances
        let instances = engine
            .generate_pending_instances()
            .await
            .expect("Failed to generate instances");

        assert!(!instances.is_empty(), "Should generate at least one instance");
        
        let instance = &instances[0];
        assert_eq!(instance.title, "Daily Test Task");
        assert_eq!(instance.description, Some("Test periodic task".to_string()));
        assert_eq!(instance.priority, 1);
        assert_eq!(instance.time_estimate, 30);
        assert_eq!(instance.is_periodic_instance, true);
        assert_eq!(instance.periodic_template_id, Some(template.id.clone()));
    }

    #[tokio::test]
    async fn test_generate_instance_from_template() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        
        let periodic_repo = PeriodicTaskRepository::new(db.clone());
        let engine = TaskGenerationEngine::new(db);

        // Create a periodic task template
        let request = CreatePeriodicTaskTemplateRequest {
            title: "Weekly Test Task".to_string(),
            description: Some("Test weekly task".to_string()),
            priority: 2,
            time_estimate: 60,
            tags: Some(vec!["weekly".to_string(), "test".to_string()]),
            task_list_id: None,
            recurrence_type: "weekly".to_string(),
            recurrence_interval: 1,
            recurrence_unit: None,
            start_date: Utc::now(),
        };

        let template = periodic_repo
            .create_template(request)
            .await
            .expect("Failed to create template");

        // Generate instance from template
        let instance = engine
            .generate_instance_from_template(&template.id)
            .await
            .expect("Failed to generate instance from template");

        assert_eq!(instance.title, "Weekly Test Task");
        assert_eq!(instance.description, Some("Test weekly task".to_string()));
        assert_eq!(instance.priority, 2);
        assert_eq!(instance.time_estimate, 60);
        assert_eq!(instance.is_periodic_instance, true);
        assert_eq!(instance.periodic_template_id, Some(template.id));
    }

    #[tokio::test]
    async fn test_check_and_generate_instances() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        
        let periodic_repo = PeriodicTaskRepository::new(db.clone());
        let engine = TaskGenerationEngine::new(db);

        // Create multiple periodic task templates with different schedules
        let past_date = Utc::now() - Duration::days(2);
        
        // Daily task that should generate multiple instances
        let daily_request = CreatePeriodicTaskTemplateRequest {
            title: "Daily Overdue Task".to_string(),
            description: Some("Should generate multiple instances".to_string()),
            priority: 1,
            time_estimate: 15,
            tags: None,
            task_list_id: None,
            recurrence_type: "daily".to_string(),
            recurrence_interval: 1,
            recurrence_unit: None,
            start_date: past_date,
        };

        let _daily_template = periodic_repo
            .create_template(daily_request)
            .await
            .expect("Failed to create daily template");

        // Future task that should not generate instances
        let future_date = Utc::now() + Duration::days(1);
        let future_request = CreatePeriodicTaskTemplateRequest {
            title: "Future Task".to_string(),
            description: Some("Should not generate instances yet".to_string()),
            priority: 1,
            time_estimate: 30,
            tags: None,
            task_list_id: None,
            recurrence_type: "daily".to_string(),
            recurrence_interval: 1,
            recurrence_unit: None,
            start_date: future_date,
        };

        let _future_template = periodic_repo
            .create_template(future_request)
            .await
            .expect("Failed to create future template");

        // Check and generate instances
        let instances = engine
            .check_and_generate_instances()
            .await
            .expect("Failed to check and generate instances");

        // Should generate instances for the overdue daily task but not the future task
        assert!(!instances.is_empty(), "Should generate instances for overdue tasks");
        
        // All generated instances should be from the daily task
        for instance in &instances {
            assert_eq!(instance.title, "Daily Overdue Task");
            assert_eq!(instance.is_periodic_instance, true);
        }
    }

    #[tokio::test]
    async fn test_inactive_template_no_generation() {
        let db = setup_test_db()
            .await
            .expect("Failed to setup test database");
        
        let periodic_repo = PeriodicTaskRepository::new(db.clone());
        let engine = TaskGenerationEngine::new(db);

        // Create a periodic task template
        let past_date = Utc::now() - Duration::hours(1);
        let request = CreatePeriodicTaskTemplateRequest {
            title: "Inactive Task".to_string(),
            description: Some("Should not generate when inactive".to_string()),
            priority: 1,
            time_estimate: 30,
            tags: None,
            task_list_id: None,
            recurrence_type: "daily".to_string(),
            recurrence_interval: 1,
            recurrence_unit: None,
            start_date: past_date,
        };

        let template = periodic_repo
            .create_template(request)
            .await
            .expect("Failed to create template");

        // Deactivate the template
        use crate::database::repositories::periodic_task_repository::UpdatePeriodicTaskTemplateRequest;
        let update_request = UpdatePeriodicTaskTemplateRequest {
            title: None,
            description: None,
            priority: None,
            time_estimate: None,
            tags: None,
            task_list_id: None,
            recurrence_type: None,
            recurrence_interval: None,
            recurrence_unit: None,
            is_active: Some(false),
        };

        periodic_repo
            .update_template(&template.id, update_request)
            .await
            .expect("Failed to update template");

        // Try to generate instances
        let instances = engine
            .generate_pending_instances()
            .await
            .expect("Failed to generate instances");

        // Should not generate any instances for inactive template
        assert!(instances.is_empty(), "Should not generate instances for inactive template");
    }
}