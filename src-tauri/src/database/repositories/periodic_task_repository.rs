use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, DbErr, EntityTrait, PaginatorTrait, QueryFilter,
    QueryOrder, Set, TransactionTrait,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::database::entities::{periodic_task_templates, tasks};

/// Request structure for creating a new periodic task template
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePeriodicTaskTemplateRequest {
    pub title: String,
    pub description: Option<String>,
    pub priority: i32,
    pub time_estimate: i32,
    pub tags: Option<Vec<String>>,
    pub task_list_id: Option<String>,
    pub recurrence_type: String,
    pub recurrence_interval: i32,
    pub recurrence_unit: Option<String>,
    pub start_date: chrono::DateTime<chrono::Utc>,
}

/// Request structure for updating an existing periodic task template
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdatePeriodicTaskTemplateRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub priority: Option<i32>,
    pub time_estimate: Option<i32>,
    pub tags: Option<Vec<String>>,
    pub task_list_id: Option<String>,
    pub recurrence_type: Option<String>,
    pub recurrence_interval: Option<i32>,
    pub recurrence_unit: Option<String>,
    pub is_active: Option<bool>,
}

/// Periodic task repository for SeaORM-based database operations
pub struct PeriodicTaskRepository {
    db: Arc<DatabaseConnection>,
}

impl PeriodicTaskRepository {
    pub fn new(db: Arc<DatabaseConnection>) -> Self {
        Self { db }
    }

    /// Create a new periodic task template
    pub async fn create_template(
        &self,
        request: CreatePeriodicTaskTemplateRequest,
    ) -> Result<periodic_task_templates::Model, DbErr> {
        let next_generation_date = self.calculate_next_generation_date(
            request.start_date,
            &request.recurrence_type,
            request.recurrence_interval,
            request.recurrence_unit.as_deref(),
        )?;

        let template = periodic_task_templates::ActiveModel {
            title: Set(request.title),
            description: Set(request.description),
            priority: Set(request.priority),
            time_estimate: Set(request.time_estimate),
            tags: Set(request
                .tags
                .map(|tags| serde_json::to_string(&tags).unwrap_or_default())),
            task_list_id: Set(request.task_list_id),
            recurrence_type: Set(request.recurrence_type),
            recurrence_interval: Set(request.recurrence_interval),
            recurrence_unit: Set(request.recurrence_unit),
            start_date: Set(request.start_date),
            next_generation_date: Set(next_generation_date),
            is_active: Set(true),
            ..Default::default()
        };

        template.insert(&*self.db).await
    }

    /// Find a periodic task template by ID
    pub async fn find_by_id(
        &self,
        id: &str,
    ) -> Result<Option<periodic_task_templates::Model>, DbErr> {
        periodic_task_templates::Entity::find_by_id(id)
            .one(&*self.db)
            .await
    }

    /// Find all periodic task templates
    pub async fn find_all(&self) -> Result<Vec<periodic_task_templates::Model>, DbErr> {
        periodic_task_templates::Entity::find()
            .order_by_desc(periodic_task_templates::Column::CreatedAt)
            .all(&*self.db)
            .await
    }

    /// Find active periodic task templates
    pub async fn find_active(&self) -> Result<Vec<periodic_task_templates::Model>, DbErr> {
        periodic_task_templates::Entity::find()
            .filter(periodic_task_templates::Column::IsActive.eq(true))
            .order_by_asc(periodic_task_templates::Column::NextGenerationDate)
            .all(&*self.db)
            .await
    }

    /// Find templates that need instance generation
    pub async fn find_templates_needing_generation(
        &self,
        current_time: chrono::DateTime<chrono::Utc>,
    ) -> Result<Vec<periodic_task_templates::Model>, DbErr> {
        periodic_task_templates::Entity::find()
            .filter(periodic_task_templates::Column::IsActive.eq(true))
            .filter(periodic_task_templates::Column::NextGenerationDate.lte(current_time))
            .order_by_asc(periodic_task_templates::Column::NextGenerationDate)
            .all(&*self.db)
            .await
    }

    /// Update a periodic task template
    pub async fn update_template(
        &self,
        id: &str,
        request: UpdatePeriodicTaskTemplateRequest,
    ) -> Result<periodic_task_templates::Model, DbErr> {
        let template = periodic_task_templates::Entity::find_by_id(id)
            .one(&*self.db)
            .await?
            .ok_or_else(|| DbErr::RecordNotFound("Periodic task template not found".to_string()))?;

        let mut template: periodic_task_templates::ActiveModel = template.into();

        if let Some(title) = request.title {
            template.title = Set(title);
        }
        if let Some(description) = request.description {
            template.description = Set(Some(description));
        }
        if let Some(priority) = request.priority {
            template.priority = Set(priority);
        }
        if let Some(time_estimate) = request.time_estimate {
            template.time_estimate = Set(time_estimate);
        }
        if let Some(tags) = request.tags {
            template.tags = Set(Some(
                serde_json::to_string(&tags).unwrap_or_default(),
            ));
        }
        if let Some(task_list_id) = request.task_list_id {
            template.task_list_id = Set(Some(task_list_id));
        }
        if let Some(recurrence_type) = request.recurrence_type {
            template.recurrence_type = Set(recurrence_type);
        }
        if let Some(recurrence_interval) = request.recurrence_interval {
            template.recurrence_interval = Set(recurrence_interval);
        }
        if let Some(recurrence_unit) = request.recurrence_unit {
            template.recurrence_unit = Set(Some(recurrence_unit));
        }
        if let Some(is_active) = request.is_active {
            template.is_active = Set(is_active);
        }

        template.updated_at = Set(chrono::Utc::now());

        template.update(&*self.db).await
    }

    /// Update the next generation date for a template
    pub async fn update_next_generation_date(
        &self,
        id: &str,
        next_date: chrono::DateTime<chrono::Utc>,
    ) -> Result<periodic_task_templates::Model, DbErr> {
        let template = periodic_task_templates::Entity::find_by_id(id)
            .one(&*self.db)
            .await?
            .ok_or_else(|| DbErr::RecordNotFound("Periodic task template not found".to_string()))?;

        let mut template: periodic_task_templates::ActiveModel = template.into();
        template.next_generation_date = Set(next_date);
        template.updated_at = Set(chrono::Utc::now());

        template.update(&*self.db).await
    }

    /// Delete a periodic task template
    pub async fn delete_template(&self, id: &str) -> Result<(), DbErr> {
        let txn = self.db.begin().await?;

        // Check if there are any instances of this template
        let instance_count = tasks::Entity::find()
            .filter(tasks::Column::PeriodicTemplateId.eq(Some(id.to_string())))
            .count(&txn)
            .await?;

        if instance_count > 0 {
            // Update instances to remove the template reference instead of deleting them
            tasks::Entity::update_many()
                .col_expr(
                    tasks::Column::PeriodicTemplateId,
                    sea_orm::sea_query::Expr::value(None::<String>),
                )
                .col_expr(
                    tasks::Column::IsPeriodicInstance,
                    sea_orm::sea_query::Expr::value(false),
                )
                .col_expr(
                    tasks::Column::UpdatedAt,
                    sea_orm::sea_query::Expr::value(chrono::Utc::now()),
                )
                .filter(tasks::Column::PeriodicTemplateId.eq(Some(id.to_string())))
                .exec(&txn)
                .await?;
        }

        // Delete the template
        periodic_task_templates::Entity::delete_by_id(id)
            .exec(&txn)
            .await?;

        txn.commit().await
    }

    /// Get instances created from a template
    pub async fn get_template_instances(
        &self,
        template_id: &str,
    ) -> Result<Vec<tasks::Model>, DbErr> {
        tasks::Entity::find()
            .filter(tasks::Column::PeriodicTemplateId.eq(Some(template_id.to_string())))
            .filter(tasks::Column::IsPeriodicInstance.eq(true))
            .order_by_desc(tasks::Column::GenerationDate)
            .all(&*self.db)
            .await
    }

    /// Count instances created from a template
    pub async fn count_template_instances(&self, template_id: &str) -> Result<u64, DbErr> {
        tasks::Entity::find()
            .filter(tasks::Column::PeriodicTemplateId.eq(Some(template_id.to_string())))
            .filter(tasks::Column::IsPeriodicInstance.eq(true))
            .count(&*self.db)
            .await
    }

    /// Calculate the next generation date based on recurrence pattern
    pub fn calculate_next_generation_date(
        &self,
        current_date: chrono::DateTime<chrono::Utc>,
        recurrence_type: &str,
        interval: i32,
        unit: Option<&str>,
    ) -> Result<chrono::DateTime<chrono::Utc>, DbErr> {
        let mut next_date = current_date;

        match recurrence_type {
            "daily" => {
                next_date = next_date + chrono::Duration::days(interval as i64);
            }
            "weekly" => {
                next_date = next_date + chrono::Duration::weeks(interval as i64);
            }
            "biweekly" => {
                next_date = next_date + chrono::Duration::weeks(2);
            }
            "every_three_weeks" => {
                next_date = next_date + chrono::Duration::weeks(3);
            }
            "monthly" => {
                // Add months while preserving the day of month
                if let Some(new_date) = next_date
                    .checked_add_months(chrono::Months::new(interval as u32))
                {
                    next_date = new_date;
                } else {
                    return Err(DbErr::Custom("Invalid date calculation".to_string()));
                }
            }
            "custom" => {
                match unit {
                    Some("days") => {
                        next_date = next_date + chrono::Duration::days(interval as i64);
                    }
                    Some("weeks") => {
                        next_date = next_date + chrono::Duration::weeks(interval as i64);
                    }
                    Some("months") => {
                        if let Some(new_date) = next_date
                            .checked_add_months(chrono::Months::new(interval as u32))
                        {
                            next_date = new_date;
                        } else {
                            return Err(DbErr::Custom("Invalid date calculation".to_string()));
                        }
                    }
                    _ => {
                        return Err(DbErr::Custom(
                            "Invalid recurrence unit for custom type".to_string(),
                        ));
                    }
                }
            }
            _ => {
                return Err(DbErr::Custom("Invalid recurrence type".to_string()));
            }
        }

        Ok(next_date)
    }

    /// Check if a template should generate an instance
    #[allow(dead_code)]
    pub fn should_generate_instance(
        &self,
        template: &periodic_task_templates::Model,
        current_time: chrono::DateTime<chrono::Utc>,
    ) -> bool {
        template.is_active && template.next_generation_date <= current_time
    }

    /// Get all periodic task templates for backup
    #[allow(dead_code)]
    pub async fn get_all_templates(&self) -> Result<Vec<periodic_task_templates::Model>, DbErr> {
        periodic_task_templates::Entity::find().all(&*self.db).await
    }

    /// Import a periodic task template from backup data
    #[allow(dead_code)]
    pub async fn import_template(
        &self,
        template: periodic_task_templates::Model,
    ) -> Result<periodic_task_templates::Model, DbErr> {
        let active_template = periodic_task_templates::ActiveModel {
            id: Set(template.id),
            title: Set(template.title),
            description: Set(template.description),
            priority: Set(template.priority),
            time_estimate: Set(template.time_estimate),
            tags: Set(template.tags),
            task_list_id: Set(template.task_list_id),
            recurrence_type: Set(template.recurrence_type),
            recurrence_interval: Set(template.recurrence_interval),
            recurrence_unit: Set(template.recurrence_unit),
            start_date: Set(template.start_date),
            next_generation_date: Set(template.next_generation_date),
            is_active: Set(template.is_active),
            created_at: Set(template.created_at),
            updated_at: Set(template.updated_at),
        };

        active_template.insert(&*self.db).await
    }

    /// Delete all periodic task templates
    #[allow(dead_code)]
    pub async fn delete_all_templates(&self) -> Result<u64, DbErr> {
        let result = periodic_task_templates::Entity::delete_many()
            .exec(&*self.db)
            .await?;
        Ok(result.rows_affected)
    }

    /// Count all periodic task templates
    pub async fn count_all_templates(&self) -> Result<u64, DbErr> {
        periodic_task_templates::Entity::find()
            .count(&*self.db)
            .await
    }
}

/// Statistics for periodic task templates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeriodicTaskStats {
    pub total_templates: u64,
    pub active_templates: u64,
    pub inactive_templates: u64,
    pub total_instances: u64,
}

impl PeriodicTaskRepository {
    /// Get periodic task statistics
    pub async fn get_periodic_task_stats(&self) -> Result<PeriodicTaskStats, DbErr> {
        let total_templates = self.count_all_templates().await?;
        
        let active_templates = periodic_task_templates::Entity::find()
            .filter(periodic_task_templates::Column::IsActive.eq(true))
            .count(&*self.db)
            .await?;
        
        let inactive_templates = total_templates - active_templates;
        
        let total_instances = tasks::Entity::find()
            .filter(tasks::Column::IsPeriodicInstance.eq(true))
            .count(&*self.db)
            .await?;

        Ok(PeriodicTaskStats {
            total_templates,
            active_templates,
            inactive_templates,
            total_instances,
        })
    }
}