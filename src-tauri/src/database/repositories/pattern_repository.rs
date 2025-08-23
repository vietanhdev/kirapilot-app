use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, DbErr, EntityTrait, QueryFilter, QueryOrder,
    Set,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::database::entities::productivity_patterns;

/// Request structure for creating a new productivity pattern
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePatternRequest {
    pub user_id: String,
    pub pattern_type: String,
    pub time_slot: String,
    pub productivity_score: f64,
    pub confidence_level: f64,
    pub sample_size: i32,
}

/// Request structure for updating a productivity pattern
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdatePatternRequest {
    pub productivity_score: Option<f64>,
    pub confidence_level: Option<f64>,
    pub sample_size: Option<i32>,
}

/// Productivity insights based on patterns
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductivityInsights {
    pub most_productive_hours: Vec<String>,
    pub least_productive_hours: Vec<String>,
    pub best_days_of_week: Vec<String>,
    pub optimal_session_length: Option<i32>,
    pub focus_patterns: Vec<FocusPattern>,
    pub recommendations: Vec<String>,
}

/// Focus pattern analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FocusPattern {
    pub pattern_type: String,
    pub time_slot: String,
    pub productivity_score: f64,
    pub confidence_level: f64,
    pub sample_size: i32,
    pub trend: String, // "improving", "declining", "stable"
}

/// Pattern statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatternStats {
    pub total_patterns: u64,
    pub high_confidence_patterns: u64,
    pub average_productivity_score: f64,
    pub patterns_by_type: std::collections::HashMap<String, u64>,
}

/// Pattern repository for SeaORM-based database operations
#[allow(dead_code)]
pub struct PatternRepository {
    db: Arc<DatabaseConnection>,
}

#[allow(dead_code)]
impl PatternRepository {
    pub fn new(db: Arc<DatabaseConnection>) -> Self {
        Self { db }
    }

    /// Create a new productivity pattern
    pub async fn create_pattern(
        &self,
        request: CreatePatternRequest,
    ) -> Result<productivity_patterns::Model, DbErr> {
        let pattern = productivity_patterns::ActiveModel {
            user_id: Set(request.user_id),
            pattern_type: Set(request.pattern_type),
            time_slot: Set(request.time_slot),
            productivity_score: Set(request.productivity_score),
            confidence_level: Set(request.confidence_level),
            sample_size: Set(request.sample_size),
            ..Default::default()
        };

        pattern.insert(&*self.db).await
    }

    /// Find a pattern by ID
    pub async fn find_by_id(
        &self,
        id: &str,
    ) -> Result<Option<productivity_patterns::Model>, DbErr> {
        productivity_patterns::Entity::find_by_id(id)
            .one(&*self.db)
            .await
    }

    /// Find all patterns for a user
    pub async fn find_patterns_for_user(
        &self,
        user_id: &str,
    ) -> Result<Vec<productivity_patterns::Model>, DbErr> {
        productivity_patterns::Entity::find()
            .filter(productivity_patterns::Column::UserId.eq(user_id))
            .order_by_desc(productivity_patterns::Column::UpdatedAt)
            .all(&*self.db)
            .await
    }

    /// Find patterns by type
    pub async fn find_by_pattern_type(
        &self,
        user_id: &str,
        pattern_type: &str,
    ) -> Result<Vec<productivity_patterns::Model>, DbErr> {
        productivity_patterns::Entity::find()
            .filter(productivity_patterns::Column::UserId.eq(user_id))
            .filter(productivity_patterns::Column::PatternType.eq(pattern_type))
            .order_by_desc(productivity_patterns::Column::ProductivityScore)
            .all(&*self.db)
            .await
    }

    /// Find patterns by time slot
    pub async fn find_by_time_slot(
        &self,
        user_id: &str,
        time_slot: &str,
    ) -> Result<Vec<productivity_patterns::Model>, DbErr> {
        productivity_patterns::Entity::find()
            .filter(productivity_patterns::Column::UserId.eq(user_id))
            .filter(productivity_patterns::Column::TimeSlot.eq(time_slot))
            .order_by_desc(productivity_patterns::Column::ProductivityScore)
            .all(&*self.db)
            .await
    }

    /// Find high-confidence patterns
    pub async fn find_high_confidence_patterns(
        &self,
        user_id: &str,
        min_confidence: f64,
    ) -> Result<Vec<productivity_patterns::Model>, DbErr> {
        productivity_patterns::Entity::find()
            .filter(productivity_patterns::Column::UserId.eq(user_id))
            .filter(productivity_patterns::Column::ConfidenceLevel.gte(min_confidence))
            .order_by_desc(productivity_patterns::Column::ProductivityScore)
            .all(&*self.db)
            .await
    }

    /// Update a pattern
    pub async fn update_pattern(
        &self,
        id: &str,
        request: UpdatePatternRequest,
    ) -> Result<productivity_patterns::Model, DbErr> {
        let pattern = productivity_patterns::Entity::find_by_id(id)
            .one(&*self.db)
            .await?
            .ok_or_else(|| DbErr::RecordNotFound("Productivity pattern not found".to_string()))?;

        let mut pattern: productivity_patterns::ActiveModel = pattern.into();

        if let Some(productivity_score) = request.productivity_score {
            pattern.productivity_score = Set(productivity_score);
        }
        if let Some(confidence_level) = request.confidence_level {
            pattern.confidence_level = Set(confidence_level);
        }
        if let Some(sample_size) = request.sample_size {
            pattern.sample_size = Set(sample_size);
        }

        pattern.updated_at = Set(chrono::Utc::now());

        pattern.update(&*self.db).await
    }

    /// Update or create pattern (upsert)
    pub async fn upsert_pattern(
        &self,
        request: CreatePatternRequest,
    ) -> Result<productivity_patterns::Model, DbErr> {
        // Try to find existing pattern
        let existing = productivity_patterns::Entity::find()
            .filter(productivity_patterns::Column::UserId.eq(&request.user_id))
            .filter(productivity_patterns::Column::PatternType.eq(&request.pattern_type))
            .filter(productivity_patterns::Column::TimeSlot.eq(&request.time_slot))
            .one(&*self.db)
            .await?;

        match existing {
            Some(pattern) => {
                // Update existing pattern
                let mut pattern: productivity_patterns::ActiveModel = pattern.into();

                // Weighted average for productivity score
                let old_weight = *pattern.sample_size.as_ref();
                let new_weight = request.sample_size;
                let total_weight = old_weight + new_weight;

                if total_weight > 0 {
                    let old_score = *pattern.productivity_score.as_ref();
                    let weighted_score = (old_score * (old_weight as f64)
                        + request.productivity_score * (new_weight as f64))
                        / (total_weight as f64);
                    pattern.productivity_score = Set(weighted_score);
                }

                pattern.confidence_level = Set(request.confidence_level);
                pattern.sample_size = Set(total_weight);
                pattern.updated_at = Set(chrono::Utc::now());

                pattern.update(&*self.db).await
            }
            None => {
                // Create new pattern
                self.create_pattern(request).await
            }
        }
    }

    /// Delete a pattern
    pub async fn delete_pattern(&self, id: &str) -> Result<(), DbErr> {
        productivity_patterns::Entity::delete_by_id(id)
            .exec(&*self.db)
            .await?;
        Ok(())
    }

    /// Delete all patterns for a user
    pub async fn delete_user_patterns(&self, user_id: &str) -> Result<(), DbErr> {
        productivity_patterns::Entity::delete_many()
            .filter(productivity_patterns::Column::UserId.eq(user_id))
            .exec(&*self.db)
            .await?;
        Ok(())
    }

    /// Get productivity insights for a user
    pub async fn get_productivity_insights(
        &self,
        user_id: &str,
    ) -> Result<ProductivityInsights, DbErr> {
        let patterns = self.find_patterns_for_user(user_id).await?;

        // Find most productive hours
        let hourly_patterns: Vec<_> = patterns
            .iter()
            .filter(|p| p.pattern_type == "hourly")
            .collect();

        let mut most_productive_hours = hourly_patterns
            .iter()
            .filter(|p| p.confidence_level >= 0.7)
            .collect::<Vec<_>>();
        most_productive_hours.sort_by(|a, b| {
            b.productivity_score
                .partial_cmp(&a.productivity_score)
                .unwrap()
        });

        let most_productive_hours: Vec<String> = most_productive_hours
            .into_iter()
            .take(3)
            .map(|p| p.time_slot.clone())
            .collect();

        // Find least productive hours
        let mut least_productive_hours = hourly_patterns
            .iter()
            .filter(|p| p.confidence_level >= 0.7)
            .collect::<Vec<_>>();
        least_productive_hours.sort_by(|a, b| {
            a.productivity_score
                .partial_cmp(&b.productivity_score)
                .unwrap()
        });

        let least_productive_hours: Vec<String> = least_productive_hours
            .into_iter()
            .take(3)
            .map(|p| p.time_slot.clone())
            .collect();

        // Find best days of week
        let daily_patterns: Vec<_> = patterns
            .iter()
            .filter(|p| p.pattern_type == "daily")
            .collect();

        let mut best_days = daily_patterns
            .iter()
            .filter(|p| p.confidence_level >= 0.7)
            .collect::<Vec<_>>();
        best_days.sort_by(|a, b| {
            b.productivity_score
                .partial_cmp(&a.productivity_score)
                .unwrap()
        });

        let best_days_of_week: Vec<String> = best_days
            .into_iter()
            .take(3)
            .map(|p| p.time_slot.clone())
            .collect();

        // Find optimal session length
        let session_patterns: Vec<_> = patterns
            .iter()
            .filter(|p| p.pattern_type == "session_length")
            .collect();

        let optimal_session_length = session_patterns
            .iter()
            .filter(|p| p.confidence_level >= 0.7)
            .max_by(|a, b| {
                a.productivity_score
                    .partial_cmp(&b.productivity_score)
                    .unwrap()
            })
            .and_then(|p| p.time_slot.parse::<i32>().ok());

        // Create focus patterns
        let focus_patterns: Vec<FocusPattern> = patterns
            .iter()
            .filter(|p| p.confidence_level >= 0.5)
            .map(|p| {
                let trend = if p.productivity_score >= 0.8 {
                    "improving"
                } else if p.productivity_score <= 0.4 {
                    "declining"
                } else {
                    "stable"
                };

                FocusPattern {
                    pattern_type: p.pattern_type.clone(),
                    time_slot: p.time_slot.clone(),
                    productivity_score: p.productivity_score,
                    confidence_level: p.confidence_level,
                    sample_size: p.sample_size,
                    trend: trend.to_string(),
                }
            })
            .collect();

        // Generate recommendations
        let mut recommendations = Vec::new();

        if !most_productive_hours.is_empty() {
            recommendations.push(format!(
                "Schedule your most important tasks during your peak hours: {}",
                most_productive_hours.join(", ")
            ));
        }

        if let Some(optimal_length) = optimal_session_length {
            recommendations.push(format!(
                "Your optimal focus session length is {} minutes",
                optimal_length
            ));
        }

        if !best_days_of_week.is_empty() {
            recommendations.push(format!(
                "You're most productive on: {}",
                best_days_of_week.join(", ")
            ));
        }

        Ok(ProductivityInsights {
            most_productive_hours,
            least_productive_hours,
            best_days_of_week,
            optimal_session_length,
            focus_patterns,
            recommendations,
        })
    }

    /// Get pattern statistics
    pub async fn get_pattern_stats(&self, user_id: &str) -> Result<PatternStats, DbErr> {
        let patterns = self.find_patterns_for_user(user_id).await?;

        let total_patterns = patterns.len() as u64;
        let high_confidence_patterns = patterns
            .iter()
            .filter(|p| p.confidence_level >= 0.7)
            .count() as u64;

        let average_productivity_score = if !patterns.is_empty() {
            patterns.iter().map(|p| p.productivity_score).sum::<f64>() / patterns.len() as f64
        } else {
            0.0
        };

        let mut patterns_by_type = std::collections::HashMap::new();
        for pattern in &patterns {
            let count = patterns_by_type
                .entry(pattern.pattern_type.clone())
                .or_insert(0u64);
            *count += 1;
        }

        Ok(PatternStats {
            total_patterns,
            high_confidence_patterns,
            average_productivity_score,
            patterns_by_type,
        })
    }

    /// Analyze productivity trends
    pub async fn analyze_trends(
        &self,
        user_id: &str,
        days_back: i64,
    ) -> Result<Vec<FocusPattern>, DbErr> {
        let cutoff_date = chrono::Utc::now() - chrono::Duration::days(days_back);

        let recent_patterns = productivity_patterns::Entity::find()
            .filter(productivity_patterns::Column::UserId.eq(user_id))
            .filter(productivity_patterns::Column::UpdatedAt.gte(cutoff_date))
            .order_by_desc(productivity_patterns::Column::UpdatedAt)
            .all(&*self.db)
            .await?;

        let trends: Vec<FocusPattern> = recent_patterns
            .iter()
            .map(|p| {
                let trend = if p.productivity_score >= 0.8 {
                    "improving"
                } else if p.productivity_score <= 0.4 {
                    "declining"
                } else {
                    "stable"
                };

                FocusPattern {
                    pattern_type: p.pattern_type.clone(),
                    time_slot: p.time_slot.clone(),
                    productivity_score: p.productivity_score,
                    confidence_level: p.confidence_level,
                    sample_size: p.sample_size,
                    trend: trend.to_string(),
                }
            })
            .collect();

        Ok(trends)
    }
}
