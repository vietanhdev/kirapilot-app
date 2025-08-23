use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, DbErr, EntityTrait, QueryFilter, QueryOrder,
    QuerySelect, Set,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::database::entities::{focus_sessions, tasks};

/// Request structure for creating a new focus session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateFocusSessionRequest {
    pub task_id: String,
    pub planned_duration: i32,
    pub distraction_level: String,
    pub background_audio: Option<String>,
    pub notes: Option<String>,
}

/// Request structure for updating a focus session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFocusSessionRequest {
    pub actual_duration: Option<i32>,
    pub focus_score: Option<f64>,
    pub distraction_count: Option<i32>,
    pub distraction_level: Option<String>,
    pub background_audio: Option<String>,
    pub notes: Option<String>,
    pub breaks: Option<Vec<FocusBreak>>,
    pub metrics: Option<FocusMetrics>,
    pub completed_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// Structure for focus breaks within a session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FocusBreak {
    pub start_time: chrono::DateTime<chrono::Utc>,
    pub end_time: chrono::DateTime<chrono::Utc>,
    pub break_type: String, // "short", "long", "distraction"
    pub reason: Option<String>,
}

/// Focus session metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FocusMetrics {
    pub deep_work_percentage: f64,
    pub interruption_count: i32,
    pub flow_state_duration: i32,
    pub productivity_rating: Option<i32>,
    pub energy_level_start: Option<i32>,
    pub energy_level_end: Option<i32>,
}

/// Focus statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FocusStats {
    pub total_sessions: u64,
    pub total_planned_minutes: i64,
    pub total_actual_minutes: i64,
    pub average_focus_score: f64,
    pub completion_rate: f64,
    pub most_productive_distraction_level: String,
    pub sessions_by_day: Vec<DayFocusStats>,
}

/// Daily focus statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DayFocusStats {
    pub date: chrono::NaiveDate,
    pub session_count: u64,
    pub total_planned_minutes: i64,
    pub total_actual_minutes: i64,
    pub average_focus_score: f64,
}

/// Focus repository for SeaORM-based database operations
#[allow(dead_code)]
pub struct FocusRepository {
    db: Arc<DatabaseConnection>,
}

#[allow(dead_code)]
impl FocusRepository {
    pub fn new(db: Arc<DatabaseConnection>) -> Self {
        Self { db }
    }

    /// Create a new focus session
    pub async fn create_session(
        &self,
        request: CreateFocusSessionRequest,
    ) -> Result<focus_sessions::Model, DbErr> {
        // Verify task exists
        let task_exists = tasks::Entity::find_by_id(&request.task_id)
            .one(&*self.db)
            .await?
            .is_some();

        if !task_exists {
            return Err(DbErr::RecordNotFound("Task not found".to_string()));
        }

        let session = focus_sessions::ActiveModel {
            task_id: Set(request.task_id),
            planned_duration: Set(request.planned_duration),
            actual_duration: Set(None),
            focus_score: Set(None),
            distraction_count: Set(0),
            distraction_level: Set(request.distraction_level),
            background_audio: Set(request.background_audio),
            notes: Set(request.notes),
            breaks: Set(None),
            metrics: Set(None),
            completed_at: Set(None),
            ..Default::default()
        };

        session.insert(&*self.db).await
    }

    /// Find a focus session by ID
    pub async fn find_by_id(&self, id: &str) -> Result<Option<focus_sessions::Model>, DbErr> {
        focus_sessions::Entity::find_by_id(id).one(&*self.db).await
    }

    /// Find all focus sessions for a task
    pub async fn find_sessions_for_task(
        &self,
        task_id: &str,
    ) -> Result<Vec<focus_sessions::Model>, DbErr> {
        focus_sessions::Entity::find()
            .filter(focus_sessions::Column::TaskId.eq(task_id))
            .order_by_desc(focus_sessions::Column::CreatedAt)
            .all(&*self.db)
            .await
    }

    /// Find focus sessions within a date range
    pub async fn find_sessions_between(
        &self,
        start_date: chrono::DateTime<chrono::Utc>,
        end_date: chrono::DateTime<chrono::Utc>,
    ) -> Result<Vec<focus_sessions::Model>, DbErr> {
        focus_sessions::Entity::find()
            .filter(focus_sessions::Column::CreatedAt.between(start_date, end_date))
            .order_by_desc(focus_sessions::Column::CreatedAt)
            .all(&*self.db)
            .await
    }

    /// Find active focus session (not completed)
    pub async fn find_active_session(&self) -> Result<Option<focus_sessions::Model>, DbErr> {
        focus_sessions::Entity::find()
            .filter(focus_sessions::Column::CompletedAt.is_null())
            .one(&*self.db)
            .await
    }

    /// Update a focus session
    pub async fn update_session(
        &self,
        id: &str,
        request: UpdateFocusSessionRequest,
    ) -> Result<focus_sessions::Model, DbErr> {
        let session = focus_sessions::Entity::find_by_id(id)
            .one(&*self.db)
            .await?
            .ok_or_else(|| DbErr::RecordNotFound("Focus session not found".to_string()))?;

        let mut session: focus_sessions::ActiveModel = session.into();

        if let Some(actual_duration) = request.actual_duration {
            session.actual_duration = Set(Some(actual_duration));
        }
        if let Some(focus_score) = request.focus_score {
            session.focus_score = Set(Some(focus_score));
        }
        if let Some(distraction_count) = request.distraction_count {
            session.distraction_count = Set(distraction_count);
        }
        if let Some(distraction_level) = request.distraction_level {
            session.distraction_level = Set(distraction_level);
        }
        if let Some(background_audio) = request.background_audio {
            session.background_audio = Set(Some(background_audio));
        }
        if let Some(notes) = request.notes {
            session.notes = Set(Some(notes));
        }
        if let Some(breaks) = request.breaks {
            session.breaks = Set(Some(serde_json::to_string(&breaks).unwrap_or_default()));
        }
        if let Some(metrics) = request.metrics {
            session.metrics = Set(Some(serde_json::to_string(&metrics).unwrap_or_default()));
        }
        if let Some(completed_at) = request.completed_at {
            session.completed_at = Set(Some(completed_at));
        }

        session.update(&*self.db).await
    }

    /// Complete a focus session
    pub async fn complete_session(
        &self,
        id: &str,
        actual_duration: i32,
        focus_score: f64,
        distraction_count: i32,
        notes: Option<String>,
    ) -> Result<focus_sessions::Model, DbErr> {
        let session = focus_sessions::Entity::find_by_id(id)
            .one(&*self.db)
            .await?
            .ok_or_else(|| DbErr::RecordNotFound("Focus session not found".to_string()))?;

        let mut session: focus_sessions::ActiveModel = session.into();

        session.actual_duration = Set(Some(actual_duration));
        session.focus_score = Set(Some(focus_score));
        session.distraction_count = Set(distraction_count);
        session.completed_at = Set(Some(chrono::Utc::now()));

        if let Some(notes) = notes {
            session.notes = Set(Some(notes));
        }

        session.update(&*self.db).await
    }

    /// Delete a focus session
    pub async fn delete_session(&self, id: &str) -> Result<(), DbErr> {
        focus_sessions::Entity::delete_by_id(id)
            .exec(&*self.db)
            .await?;
        Ok(())
    }

    /// Get focus statistics for a date range
    pub async fn get_focus_stats(
        &self,
        start_date: chrono::DateTime<chrono::Utc>,
        end_date: chrono::DateTime<chrono::Utc>,
    ) -> Result<FocusStats, DbErr> {
        let sessions = self.find_sessions_between(start_date, end_date).await?;

        let total_sessions = sessions.len() as u64;
        let mut total_planned_minutes = 0i64;
        let mut total_actual_minutes = 0i64;
        let mut focus_scores = Vec::new();
        let mut completed_sessions = 0u64;
        let mut distraction_level_counts = std::collections::HashMap::new();
        let mut day_stats = std::collections::HashMap::new();

        for session in &sessions {
            total_planned_minutes += session.planned_duration as i64;

            if let Some(actual_duration) = session.actual_duration {
                total_actual_minutes += actual_duration as i64;
                completed_sessions += 1;
            }

            if let Some(focus_score) = session.focus_score {
                focus_scores.push(focus_score);
            }

            // Track distraction level effectiveness
            let count = distraction_level_counts
                .entry(session.distraction_level.clone())
                .or_insert(0u64);
            *count += 1;

            // Track daily stats
            let date = session.created_at.date_naive();
            let day_stat = day_stats.entry(date).or_insert(DayFocusStats {
                date,
                session_count: 0,
                total_planned_minutes: 0,
                total_actual_minutes: 0,
                average_focus_score: 0.0,
            });

            day_stat.session_count += 1;
            day_stat.total_planned_minutes += session.planned_duration as i64;

            if let Some(actual_duration) = session.actual_duration {
                day_stat.total_actual_minutes += actual_duration as i64;
            }
        }

        let average_focus_score = if !focus_scores.is_empty() {
            focus_scores.iter().sum::<f64>() / focus_scores.len() as f64
        } else {
            0.0
        };

        let completion_rate = if total_sessions > 0 {
            completed_sessions as f64 / total_sessions as f64
        } else {
            0.0
        };

        let most_productive_distraction_level = distraction_level_counts
            .into_iter()
            .max_by_key(|(_, count)| *count)
            .map(|(level, _)| level)
            .unwrap_or_else(|| "medium".to_string());

        // Calculate average focus scores for each day
        for day_stat in day_stats.values_mut() {
            let day_sessions: Vec<_> = sessions
                .iter()
                .filter(|s| s.created_at.date_naive() == day_stat.date)
                .collect();

            let day_focus_scores: Vec<f64> =
                day_sessions.iter().filter_map(|s| s.focus_score).collect();

            day_stat.average_focus_score = if !day_focus_scores.is_empty() {
                day_focus_scores.iter().sum::<f64>() / day_focus_scores.len() as f64
            } else {
                0.0
            };
        }

        let mut sessions_by_day: Vec<DayFocusStats> = day_stats.into_values().collect();
        sessions_by_day.sort_by_key(|stats| stats.date);

        Ok(FocusStats {
            total_sessions,
            total_planned_minutes,
            total_actual_minutes,
            average_focus_score,
            completion_rate,
            most_productive_distraction_level,
            sessions_by_day,
        })
    }

    /// Get focus sessions with their associated tasks
    pub async fn get_sessions_with_tasks(
        &self,
        start_date: chrono::DateTime<chrono::Utc>,
        end_date: chrono::DateTime<chrono::Utc>,
    ) -> Result<Vec<(focus_sessions::Model, Option<tasks::Model>)>, DbErr> {
        focus_sessions::Entity::find()
            .filter(focus_sessions::Column::CreatedAt.between(start_date, end_date))
            .find_also_related(tasks::Entity)
            .order_by_desc(focus_sessions::Column::CreatedAt)
            .all(&*self.db)
            .await
    }

    /// Get recent focus sessions (last N sessions)
    pub async fn get_recent_sessions(
        &self,
        limit: u64,
    ) -> Result<Vec<focus_sessions::Model>, DbErr> {
        focus_sessions::Entity::find()
            .order_by_desc(focus_sessions::Column::CreatedAt)
            .limit(limit)
            .all(&*self.db)
            .await
    }

    /// Get focus sessions by distraction level
    pub async fn find_by_distraction_level(
        &self,
        level: &str,
    ) -> Result<Vec<focus_sessions::Model>, DbErr> {
        focus_sessions::Entity::find()
            .filter(focus_sessions::Column::DistractionLevel.eq(level))
            .order_by_desc(focus_sessions::Column::CreatedAt)
            .all(&*self.db)
            .await
    }

    /// Get average focus score for a task
    pub async fn get_task_average_focus_score(&self, task_id: &str) -> Result<Option<f64>, DbErr> {
        let sessions = self.find_sessions_for_task(task_id).await?;

        let focus_scores: Vec<f64> = sessions
            .iter()
            .filter_map(|session| session.focus_score)
            .collect();

        if focus_scores.is_empty() {
            Ok(None)
        } else {
            Ok(Some(
                focus_scores.iter().sum::<f64>() / focus_scores.len() as f64,
            ))
        }
    }
}
