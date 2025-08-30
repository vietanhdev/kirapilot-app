use sea_orm::entity::prelude::*;
use sea_orm::{ActiveModelTrait, Set};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "tool_execution_logs")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    
    /// Session ID this execution belongs to
    pub session_id: String,
    
    /// Tool name that was executed
    pub tool_name: String,
    
    /// Parameters passed to the tool (JSON)
    pub parameters: String,
    
    /// Inferred parameters information (JSON)
    pub inference_info: Option<String>,
    
    /// Execution result (JSON)
    pub result: String,
    
    /// Context at time of execution (JSON)
    pub context: String,
    
    /// Execution timestamp
    pub timestamp: DateTimeUtc,
    
    /// User who triggered the execution
    pub user_id: Option<String>,
    
    /// Execution time in milliseconds
    pub execution_time_ms: i64,
    
    /// Whether execution was successful
    pub success: bool,
    
    /// Error message if failed
    pub error: Option<String>,
    
    /// Performance classification (fast, normal, slow, very_slow)
    pub performance_class: String,
    
    /// Tool category (task_management, time_tracking, analytics, general)
    pub tool_category: String,
    
    /// Additional metadata (JSON)
    pub metadata: Option<String>,
    
    /// Recovery suggestions if failed (JSON array)
    pub recovery_suggestions: Option<String>,
    
    /// Created timestamp
    pub created_at: DateTimeUtc,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {
    fn new() -> Self {
        Self {
            id: Set(uuid::Uuid::new_v4().to_string()),
            timestamp: Set(chrono::Utc::now()),
            created_at: Set(chrono::Utc::now()),
            ..ActiveModelTrait::default()
        }
    }
}