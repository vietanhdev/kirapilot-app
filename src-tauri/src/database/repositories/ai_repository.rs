use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, DbErr, EntityTrait, QueryFilter, QueryOrder, QuerySelect, Set
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::database::entities::ai_interactions;

/// Request structure for creating a new AI interaction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAiInteractionRequest {
    pub message: String,
    pub response: String,
    pub action_taken: Option<String>,
    pub reasoning: Option<String>,
    pub tools_used: Option<Vec<String>>, // Will be serialized to JSON
    pub confidence: Option<f64>,
}

/// Request structure for updating an AI interaction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateAiInteractionRequest {
    pub response: Option<String>,
    pub action_taken: Option<String>,
    pub reasoning: Option<String>,
    pub tools_used: Option<Vec<String>>, // Will be serialized to JSON
    pub confidence: Option<f64>,
}

/// AI interaction statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiStats {
    pub total_interactions: u64,
    pub average_confidence: f64,
    pub most_common_actions: Vec<ActionCount>,
    pub most_used_tools: Vec<ToolCount>,
}

/// Tool count for statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCount {
    pub tool: String,
    pub count: u64,
}

/// Action count for statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionCount {
    pub action: String,
    pub count: u64,
}

/// AI repository for SeaORM-based database operations
pub struct AiRepository {
    db: Arc<DatabaseConnection>,
}

impl AiRepository {
    pub fn new(db: Arc<DatabaseConnection>) -> Self {
        Self { db }
    }

    /// Create a new AI interaction record
    pub async fn create_interaction(
        &self,
        request: CreateAiInteractionRequest,
    ) -> Result<ai_interactions::Model, DbErr> {
        let tools_json = request.tools_used
            .map(|tools| serde_json::to_string(&tools).unwrap_or_default());

        let interaction = ai_interactions::ActiveModel {
            message: Set(request.message),
            response: Set(request.response),
            action_taken: Set(request.action_taken),
            reasoning: Set(request.reasoning),
            tools_used: Set(tools_json),
            confidence: Set(request.confidence),
            ..Default::default()
        };

        interaction.insert(&*self.db).await
    }

    /// Find an AI interaction by ID
    pub async fn find_by_id(&self, id: &str) -> Result<Option<ai_interactions::Model>, DbErr> {
        ai_interactions::Entity::find_by_id(id)
            .one(&*self.db)
            .await
    }

    /// Find all AI interactions with optional filtering
    pub async fn find_all(
        &self,
        limit: Option<u64>,
        offset: Option<u64>,
    ) -> Result<Vec<ai_interactions::Model>, DbErr> {
        let mut query = ai_interactions::Entity::find()
            .order_by_desc(ai_interactions::Column::CreatedAt);

        if let Some(limit) = limit {
            query = query.limit(limit);
        }

        if let Some(offset) = offset {
            query = query.offset(offset);
        }

        query.all(&*self.db).await
    }

    /// Find AI interactions within a date range
    pub async fn find_interactions_between(
        &self,
        start_date: chrono::DateTime<chrono::Utc>,
        end_date: chrono::DateTime<chrono::Utc>,
    ) -> Result<Vec<ai_interactions::Model>, DbErr> {
        ai_interactions::Entity::find()
            .filter(ai_interactions::Column::CreatedAt.between(start_date, end_date))
            .order_by_desc(ai_interactions::Column::CreatedAt)
            .all(&*self.db)
            .await
    }

    /// Search AI interactions by message content
    pub async fn search_interactions(&self, query: &str) -> Result<Vec<ai_interactions::Model>, DbErr> {
        let search_pattern = format!("%{}%", query);

        ai_interactions::Entity::find()
            .filter(
                ai_interactions::Column::Message
                    .like(&search_pattern)
                    .or(ai_interactions::Column::Response.like(&search_pattern)),
            )
            .order_by_desc(ai_interactions::Column::CreatedAt)
            .all(&*self.db)
            .await
    }

    /// Update an AI interaction
    pub async fn update_interaction(
        &self,
        id: &str,
        request: UpdateAiInteractionRequest,
    ) -> Result<ai_interactions::Model, DbErr> {
        let interaction = ai_interactions::Entity::find_by_id(id)
            .one(&*self.db)
            .await?
            .ok_or_else(|| DbErr::RecordNotFound("AI interaction not found".to_string()))?;

        let mut interaction: ai_interactions::ActiveModel = interaction.into();

        if let Some(response) = request.response {
            interaction.response = Set(response);
        }
        if let Some(action_taken) = request.action_taken {
            interaction.action_taken = Set(Some(action_taken));
        }
        if let Some(reasoning) = request.reasoning {
            interaction.reasoning = Set(Some(reasoning));
        }
        if let Some(tools_used) = request.tools_used {
            let tools_json = serde_json::to_string(&tools_used).unwrap_or_default();
            interaction.tools_used = Set(Some(tools_json));
        }
        if let Some(confidence) = request.confidence {
            interaction.confidence = Set(Some(confidence));
        }

        interaction.update(&*self.db).await
    }

    /// Delete an AI interaction
    pub async fn delete_interaction(&self, id: &str) -> Result<(), DbErr> {
        ai_interactions::Entity::delete_by_id(id)
            .exec(&*self.db)
            .await?;
        Ok(())
    }

    /// Get AI interaction statistics
    pub async fn get_ai_stats(&self) -> Result<AiStats, DbErr> {
        let interactions = ai_interactions::Entity::find().all(&*self.db).await?;

        let total_interactions = interactions.len() as u64;
        
        let confidences: Vec<f64> = interactions
            .iter()
            .filter_map(|i| i.confidence)
            .collect();

        let average_confidence = if !confidences.is_empty() {
            confidences.iter().sum::<f64>() / confidences.len() as f64
        } else {
            0.0
        };

        // Count actions
        let mut action_counts = std::collections::HashMap::new();
        for interaction in &interactions {
            if let Some(action) = &interaction.action_taken {
                *action_counts.entry(action.clone()).or_insert(0) += 1;
            }
        }

        let mut most_common_actions: Vec<ActionCount> = action_counts
            .into_iter()
            .map(|(action, count)| ActionCount { action, count })
            .collect();

        most_common_actions.sort_by(|a, b| b.count.cmp(&a.count));
        most_common_actions.truncate(10); // Top 10 actions

        // Count tools
        let mut tool_counts = std::collections::HashMap::new();
        for interaction in &interactions {
            if let Some(tools_json) = &interaction.tools_used {
                if let Ok(tools) = serde_json::from_str::<Vec<String>>(tools_json) {
                    for tool in tools {
                        *tool_counts.entry(tool).or_insert(0) += 1;
                    }
                }
            }
        }

        let mut most_used_tools: Vec<ToolCount> = tool_counts
            .into_iter()
            .map(|(tool, count)| ToolCount { tool, count })
            .collect();

        most_used_tools.sort_by(|a, b| b.count.cmp(&a.count));
        most_used_tools.truncate(10); // Top 10 tools

        Ok(AiStats {
            total_interactions,
            average_confidence,
            most_common_actions,
            most_used_tools,
        })
    }

    /// Get recent AI interactions
    pub async fn get_recent_interactions(
        &self,
        limit: u64,
    ) -> Result<Vec<ai_interactions::Model>, DbErr> {
        ai_interactions::Entity::find()
            .order_by_desc(ai_interactions::Column::CreatedAt)
            .limit(limit)
            .all(&*self.db)
            .await
    }

    /// Clear old AI interactions (for privacy)
    pub async fn clear_old_interactions(
        &self,
        older_than: chrono::DateTime<chrono::Utc>,
    ) -> Result<u64, DbErr> {
        let result = ai_interactions::Entity::delete_many()
            .filter(ai_interactions::Column::CreatedAt.lt(older_than))
            .exec(&*self.db)
            .await?;

        Ok(result.rows_affected)
    }

    /// Get conversation history (recent interactions in chronological order)
    pub async fn get_conversation_history(
        &self,
        limit: u64,
    ) -> Result<Vec<ai_interactions::Model>, DbErr> {
        let mut interactions = ai_interactions::Entity::find()
            .order_by_desc(ai_interactions::Column::CreatedAt)
            .limit(limit)
            .all(&*self.db)
            .await?;

        // Reverse to get chronological order (oldest first)
        interactions.reverse();
        Ok(interactions)
    }

    /// Delete all AI interactions
    pub async fn delete_all_interactions(&self) -> Result<u64, DbErr> {
        let result = ai_interactions::Entity::delete_many()
            .exec(&*self.db)
            .await?;
        Ok(result.rows_affected)
    }

    /// Import an AI interaction from backup data
    pub async fn import_interaction(&self, interaction: ai_interactions::Model) -> Result<ai_interactions::Model, DbErr> {
        let active_interaction = ai_interactions::ActiveModel {
            id: Set(interaction.id),
            message: Set(interaction.message),
            response: Set(interaction.response),
            action_taken: Set(interaction.action_taken),
            reasoning: Set(interaction.reasoning),
            tools_used: Set(interaction.tools_used),
            confidence: Set(interaction.confidence),
            created_at: Set(interaction.created_at),
        };

        active_interaction.insert(&*self.db).await
    }
}
