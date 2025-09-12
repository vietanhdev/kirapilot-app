use sea_orm::entity::prelude::*;
use sea_orm::{ActiveModelTrait, Set};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "threads")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub title: String,
    pub assignment_type: Option<String>, // 'task', 'day', 'general'
    pub assignment_task_id: Option<String>,
    pub assignment_date: Option<String>, // ISO string for day assignments
    pub assignment_context: Option<String>, // JSON for additional context
    pub message_count: i32,
    pub last_message_at: Option<DateTimeUtc>,
    pub created_at: DateTimeUtc,
    pub updated_at: DateTimeUtc,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::thread_messages::Entity")]
    ThreadMessages,
    #[sea_orm(
        belongs_to = "super::tasks::Entity",
        from = "Column::AssignmentTaskId",
        to = "super::tasks::Column::Id"
    )]
    Task,
}

impl Related<super::thread_messages::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::ThreadMessages.def()
    }
}

impl Related<super::tasks::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Task.def()
    }
}

impl ActiveModelBehavior for ActiveModel {
    fn new() -> Self {
        Self {
            id: Set(uuid::Uuid::new_v4().to_string()),
            created_at: Set(chrono::Utc::now()),
            updated_at: Set(chrono::Utc::now()),
            message_count: Set(0),
            ..ActiveModelTrait::default()
        }
    }

    fn before_save<'life0, 'async_trait, C>(
        mut self,
        _db: &'life0 C,
        _insert: bool,
    ) -> core::pin::Pin<Box<dyn core::future::Future<Output = Result<Self, DbErr>> + core::marker::Send + 'async_trait>>
    where
        Self: 'async_trait,
        C: 'life0 + ConnectionTrait,
        'life0: 'async_trait,
    {
        Box::pin(async move {
            self.updated_at = Set(chrono::Utc::now());
            Ok(self)
        })
    }
}