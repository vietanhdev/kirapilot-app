use sea_orm::{DatabaseConnection, DbErr};
use std::sync::Arc;

use crate::database::entities::{periodic_task_templates, tasks};
use crate::database::repositories::{
    periodic_task_repository::PeriodicTaskRepository,
    task_repository::{CreateTaskRequest, TaskRepository},
};

/// Service responsible for generating task instances from periodic task templates
pub struct TaskGenerationEngine {
    periodic_repo: PeriodicTaskRepository,
    task_repo: TaskRepository,
}

impl TaskGenerationEngine {
    pub fn new(db: Arc<DatabaseConnection>) -> Self {
        let periodic_repo = PeriodicTaskRepository::new(db.clone());
        let task_repo = TaskRepository::new(db);
        
        Self {
            periodic_repo,
            task_repo,
        }
    }

    /// Check for templates that need instance generation and generate them
    pub async fn check_and_generate_instances(&self) -> Result<Vec<tasks::Model>, DbErr> {
        let current_time = chrono::Utc::now();
        let templates = self
            .periodic_repo
            .find_templates_needing_generation(current_time)
            .await?;

        let mut generated_instances = Vec::new();

        for template in templates {
            // Generate all overdue instances for this template
            let instances = self.generate_overdue_instances(&template, current_time).await?;
            generated_instances.extend(instances);
        }

        Ok(generated_instances)
    }

    /// Generate a single instance from a template
    pub async fn generate_instance(
        &self,
        template: &periodic_task_templates::Model,
    ) -> Result<tasks::Model, DbErr> {
        let current_time = chrono::Utc::now();
        
        // Create the task request from template properties
        let task_request = self.copy_template_properties(template, current_time);
        
        // Create the task instance
        let task = self.task_repo.create_task(task_request).await?;
        
        // Update the template's next generation date
        let next_date = self.periodic_repo.calculate_next_generation_date(
            template.next_generation_date,
            &template.recurrence_type,
            template.recurrence_interval,
            template.recurrence_unit.as_deref(),
        )?;
        
        self.periodic_repo
            .update_next_generation_date(&template.id, next_date)
            .await?;

        Ok(task)
    }

    /// Generate all overdue instances for a template
    async fn generate_overdue_instances(
        &self,
        template: &periodic_task_templates::Model,
        current_time: chrono::DateTime<chrono::Utc>,
    ) -> Result<Vec<tasks::Model>, DbErr> {
        let mut instances = Vec::new();
        let mut next_generation = template.next_generation_date;

        // Generate instances for all overdue dates
        while next_generation <= current_time {
            let task_request = self.copy_template_properties(template, next_generation);
            let task = self.task_repo.create_task(task_request).await?;
            instances.push(task);

            // Calculate the next generation date
            next_generation = self.periodic_repo.calculate_next_generation_date(
                next_generation,
                &template.recurrence_type,
                template.recurrence_interval,
                template.recurrence_unit.as_deref(),
            )?;
        }

        // Update the template with the new next generation date
        self.periodic_repo
            .update_next_generation_date(&template.id, next_generation)
            .await?;

        Ok(instances)
    }

    /// Copy properties from template to create a task request
    fn copy_template_properties(
        &self,
        template: &periodic_task_templates::Model,
        generation_date: chrono::DateTime<chrono::Utc>,
    ) -> CreateTaskRequest {
        // Parse tags from JSON string
        let tags = template
            .tags
            .as_ref()
            .and_then(|tags_str| serde_json::from_str::<Vec<String>>(tags_str).ok());

        CreateTaskRequest {
            title: template.title.clone(),
            description: template.description.clone(),
            priority: template.priority,
            status: Some("pending".to_string()),
            order_num: Some(0),
            dependencies: None,
            time_estimate: Some(template.time_estimate),
            due_date: None,
            scheduled_date: Some(generation_date),
            tags,
            project_id: None,
            parent_task_id: None,
            task_list_id: template.task_list_id.clone(),
            periodic_template_id: Some(template.id.clone()),
            is_periodic_instance: Some(true),
            generation_date: Some(generation_date),
        }
    }

    /// Generate instances for a specific template by ID
    #[allow(dead_code)]
    pub async fn generate_instances_for_template(
        &self,
        template_id: &str,
    ) -> Result<Vec<tasks::Model>, DbErr> {
        let template = self
            .periodic_repo
            .find_by_id(template_id)
            .await?
            .ok_or_else(|| DbErr::RecordNotFound("Template not found".to_string()))?;

        if !template.is_active {
            return Ok(Vec::new());
        }

        let current_time = chrono::Utc::now();
        
        if self.periodic_repo.should_generate_instance(&template, current_time) {
            self.generate_overdue_instances(&template, current_time).await
        } else {
            Ok(Vec::new())
        }
    }

    /// Force generate a single instance from a template (ignoring schedule)
    #[allow(dead_code)]
    pub async fn force_generate_instance(
        &self,
        template_id: &str,
    ) -> Result<tasks::Model, DbErr> {
        let template = self
            .periodic_repo
            .find_by_id(template_id)
            .await?
            .ok_or_else(|| DbErr::RecordNotFound("Template not found".to_string()))?;

        let current_time = chrono::Utc::now();
        let task_request = self.copy_template_properties(&template, current_time);
        
        self.task_repo.create_task(task_request).await
    }

    /// Get the next generation time for a template
    #[allow(dead_code)]
    pub async fn get_next_generation_time(
        &self,
        template_id: &str,
    ) -> Result<Option<chrono::DateTime<chrono::Utc>>, DbErr> {
        let template = self.periodic_repo.find_by_id(template_id).await?;
        
        Ok(template.map(|t| t.next_generation_date))
    }

    /// Preview when the next N instances would be generated for a template
    #[allow(dead_code)]
    pub async fn preview_next_instances(
        &self,
        template_id: &str,
        count: u32,
    ) -> Result<Vec<chrono::DateTime<chrono::Utc>>, DbErr> {
        let template = self
            .periodic_repo
            .find_by_id(template_id)
            .await?
            .ok_or_else(|| DbErr::RecordNotFound("Template not found".to_string()))?;

        let mut dates = Vec::new();
        let mut current_date = template.next_generation_date;

        for _ in 0..count {
            dates.push(current_date);
            current_date = self.periodic_repo.calculate_next_generation_date(
                current_date,
                &template.recurrence_type,
                template.recurrence_interval,
                template.recurrence_unit.as_deref(),
            )?;
        }

        Ok(dates)
    }

    /// Generate all pending instances (alias for check_and_generate_instances)
    pub async fn generate_pending_instances(&self) -> Result<Vec<tasks::Model>, DbErr> {
        self.check_and_generate_instances().await
    }

    /// Generate instance from template by ID
    pub async fn generate_instance_from_template(
        &self,
        template_id: &str,
    ) -> Result<tasks::Model, DbErr> {
        let template = self
            .periodic_repo
            .find_by_id(template_id)
            .await?
            .ok_or_else(|| DbErr::RecordNotFound("Template not found".to_string()))?;

        if !template.is_active {
            return Err(DbErr::Custom("Template is not active".to_string()));
        }

        self.generate_instance(&template).await
    }
}