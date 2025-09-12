use sea_orm::entity::prelude::*;
use sea_orm::{ActiveModelTrait, Set};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "thread_messages")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub thread_id: String,
    pub r#type: String, // 'user' or 'assistant'
    pub content: String,
    pub reasoning: Option<String>,
    pub actions: Option<String>, // JSON serialized AIAction[]
    pub suggestions: Option<String>, // JSON serialized AISuggestion[]
    pub tool_executions: Option<String>, // JSON serialized ToolExecution[]
    pub user_feedback: Option<String>, // JSON serialized UserFeedback
    pub timestamp: DateTimeUtc,
    pub created_at: DateTimeUtc,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::threads::Entity",
        from = "Column::ThreadId",
        to = "super::threads::Column::Id"
    )]
    Thread,
}

impl Related<super::threads::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Thread.def()
    }
}

impl ActiveModelBehavior for ActiveModel {
    fn new() -> Self {
        Self {
            id: Set(uuid::Uuid::new_v4().to_string()),
            created_at: Set(chrono::Utc::now()),
            timestamp: Set(chrono::Utc::now()),
            ..ActiveModelTrait::default()
        }
    }
}