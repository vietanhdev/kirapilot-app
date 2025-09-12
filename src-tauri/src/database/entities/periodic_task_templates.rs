use sea_orm::entity::prelude::*;
use sea_orm::{ActiveModelTrait, Set};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "periodic_task_templates")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub priority: i32,
    pub time_estimate: i32,
    pub tags: Option<String>, // JSON string
    pub task_list_id: Option<String>,
    pub recurrence_type: String,
    pub recurrence_interval: i32,
    pub recurrence_unit: Option<String>,
    pub start_date: DateTimeUtc,
    pub next_generation_date: DateTimeUtc,
    pub is_active: bool,
    pub created_at: DateTimeUtc,
    pub updated_at: DateTimeUtc,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::tasks::Entity")]
    Tasks,
    #[sea_orm(
        belongs_to = "super::task_lists::Entity",
        from = "Column::TaskListId",
        to = "super::task_lists::Column::Id"
    )]
    TaskList,
}

impl Related<super::tasks::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Tasks.def()
    }
}

impl Related<super::task_lists::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::TaskList.def()
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