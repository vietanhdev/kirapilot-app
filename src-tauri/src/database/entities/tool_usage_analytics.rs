use sea_orm::entity::prelude::*;
use sea_orm::{ActiveModelTrait, Set};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "tool_usage_analytics")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    
    /// Time period start for this analytics data
    pub period_start: DateTimeUtc,
    
    /// Time period end for this analytics data
    pub period_end: DateTimeUtc,
    
    /// Analytics type (daily, weekly, monthly, session)
    pub analytics_type: String,
    
    /// Most frequently used tools (JSON)
    pub most_used_tools: String,
    
    /// Tools with highest success rates (JSON)
    pub most_reliable_tools: String,
    
    /// Performance statistics by tool (JSON)
    pub performance_stats: String,
    
    /// Common error patterns (JSON)
    pub error_analysis: String,
    
    /// User behavior patterns (JSON)
    pub usage_patterns: String,
    
    /// Optimization recommendations (JSON array)
    pub recommendations: String,
    
    /// Total executions in this period
    pub total_executions: i64,
    
    /// Successful executions in this period
    pub successful_executions: i64,
    
    /// Average execution time across all tools
    pub avg_execution_time_ms: f64,
    
    /// Created timestamp
    pub created_at: DateTimeUtc,
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