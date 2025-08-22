use sea_orm::entity::prelude::*;
use sea_orm::{ActiveModelTrait, Set};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "ai_suggestions")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub suggestion_type: String,
    pub title: String,
    pub description: String,
    pub confidence: f64,
    pub actionable: bool,
    pub priority: i32,
    pub estimated_impact: f64,
    pub reasoning: Option<String>,
    pub actions: Option<String>, // JSON string
    pub created_at: DateTimeUtc,
    pub dismissed_at: Option<DateTimeUtc>,
    pub applied_at: Option<DateTimeUtc>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {
    fn new() -> Self {
        Self {
            id: Set(uuid::Uuid::new_v4().to_string()),
            created_at: Set(chrono::Utc::now()),
            ..ActiveModelTrait::default()
        }
    }
}
