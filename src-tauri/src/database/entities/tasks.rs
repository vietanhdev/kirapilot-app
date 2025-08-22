use sea_orm::entity::prelude::*;
use sea_orm::{ActiveModelTrait, Set};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "tasks")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub priority: i32,
    pub status: String,
    pub dependencies: Option<String>, // JSON string
    pub time_estimate: i32,
    pub actual_time: i32,
    pub due_date: Option<DateTimeUtc>,
    pub scheduled_date: Option<DateTimeUtc>,
    pub tags: Option<String>, // JSON string
    pub project_id: Option<String>,
    pub parent_task_id: Option<String>,
    pub subtasks: Option<String>, // JSON string
    pub completed_at: Option<DateTimeUtc>,
    pub created_at: DateTimeUtc,
    pub updated_at: DateTimeUtc,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::task_dependencies::Entity")]
    TaskDependencies,
    #[sea_orm(has_many = "super::time_sessions::Entity")]
    TimeSessions,
    #[sea_orm(has_many = "super::focus_sessions::Entity")]
    FocusSessions,
}

impl Related<super::task_dependencies::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::TaskDependencies.def()
    }
}

impl Related<super::time_sessions::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::TimeSessions.def()
    }
}

impl Related<super::focus_sessions::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::FocusSessions.def()
    }
}

impl ActiveModelBehavior for ActiveModel {
    fn new() -> Self {
        Self {
            id: Set(uuid::Uuid::new_v4().to_string()),
            created_at: Set(chrono::Utc::now()),
            updated_at: Set(chrono::Utc::now()),
            ..ActiveModelTrait::default()
        }
    }
}
