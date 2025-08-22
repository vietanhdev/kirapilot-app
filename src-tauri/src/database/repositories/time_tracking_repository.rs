use chrono::Timelike;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, DbErr, EntityTrait, QueryFilter, QueryOrder,
    QuerySelect, Set,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::database::entities::{tasks, time_sessions};

/// Request structure for creating a new time session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTimeSessionRequest {
    pub task_id: String,
    pub start_time: chrono::DateTime<chrono::Utc>,
    pub notes: Option<String>,
}

/// Request structure for updating a time session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTimeSessionRequest {
    pub end_time: Option<chrono::DateTime<chrono::Utc>>,
    pub paused_time: Option<i32>,
    pub is_active: Option<bool>,
    pub notes: Option<String>,
    pub breaks: Option<Vec<TimeBreak>>,
}

/// Structure for time breaks within a session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeBreak {
    pub start_time: chrono::DateTime<chrono::Utc>,
    pub end_time: chrono::DateTime<chrono::Utc>,
    pub reason: Option<String>,
}

/// Time tracking statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeStats {
    pub total_sessions: u64,
    pub total_time_minutes: i64,
    pub total_work_time_minutes: i64,
    pub total_break_time_minutes: i64,
    pub average_session_minutes: f64,
    pub average_productivity_score: f64,
    pub most_productive_hour: Option<u32>,
    pub sessions_by_day: Vec<DayStats>,
}

/// Daily time statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DayStats {
    pub date: chrono::NaiveDate,
    pub total_minutes: i64,
    pub session_count: u64,
}

/// Time tracking repository for SeaORM-based database operations
pub struct TimeTrackingRepository {
    db: Arc<DatabaseConnection>,
}

impl TimeTrackingRepository {
    pub fn new(db: Arc<DatabaseConnection>) -> Self {
        Self { db }
    }

    /// Create a new time session
    pub async fn create_session(
        &self,
        request: CreateTimeSessionRequest,
    ) -> Result<time_sessions::Model, DbErr> {
        // Verify task exists
        let task_exists = tasks::Entity::find_by_id(&request.task_id)
            .one(&*self.db)
            .await?
            .is_some();

        if !task_exists {
            return Err(DbErr::RecordNotFound("Task not found".to_string()));
        }

        let session = time_sessions::ActiveModel {
            task_id: Set(request.task_id),
            start_time: Set(request.start_time),
            end_time: Set(None),
            paused_time: Set(0),
            is_active: Set(true),
            notes: Set(request.notes),
            breaks: Set(None),
            ..Default::default()
        };

        session.insert(&*self.db).await
    }

    /// Find a time session by ID
    pub async fn find_by_id(&self, id: &str) -> Result<Option<time_sessions::Model>, DbErr> {
        time_sessions::Entity::find_by_id(id).one(&*self.db).await
    }

    /// Find active session for a task
    pub async fn find_active_session(
        &self,
        task_id: &str,
    ) -> Result<Option<time_sessions::Model>, DbErr> {
        time_sessions::Entity::find()
            .filter(time_sessions::Column::TaskId.eq(task_id))
            .filter(time_sessions::Column::IsActive.eq(true))
            .one(&*self.db)
            .await
    }

    /// Find any active session
    pub async fn find_any_active_session(&self) -> Result<Option<time_sessions::Model>, DbErr> {
        time_sessions::Entity::find()
            .filter(time_sessions::Column::IsActive.eq(true))
            .one(&*self.db)
            .await
    }

    /// Find all sessions for a task
    pub async fn find_sessions_for_task(
        &self,
        task_id: &str,
    ) -> Result<Vec<time_sessions::Model>, DbErr> {
        time_sessions::Entity::find()
            .filter(time_sessions::Column::TaskId.eq(task_id))
            .order_by_desc(time_sessions::Column::StartTime)
            .all(&*self.db)
            .await
    }

    /// Find sessions within a date range
    pub async fn find_sessions_between(
        &self,
        start_date: chrono::DateTime<chrono::Utc>,
        end_date: chrono::DateTime<chrono::Utc>,
    ) -> Result<Vec<time_sessions::Model>, DbErr> {
        time_sessions::Entity::find()
            .filter(time_sessions::Column::StartTime.between(start_date, end_date))
            .order_by_desc(time_sessions::Column::StartTime)
            .all(&*self.db)
            .await
    }

    /// Update a time session
    pub async fn update_session(
        &self,
        id: &str,
        request: UpdateTimeSessionRequest,
    ) -> Result<time_sessions::Model, DbErr> {
        let session = time_sessions::Entity::find_by_id(id)
            .one(&*self.db)
            .await?
            .ok_or_else(|| DbErr::RecordNotFound("Time session not found".to_string()))?;

        let mut session: time_sessions::ActiveModel = session.into();

        if let Some(end_time) = request.end_time {
            session.end_time = Set(Some(end_time));
        }
        if let Some(paused_time) = request.paused_time {
            session.paused_time = Set(paused_time);
        }
        if let Some(is_active) = request.is_active {
            session.is_active = Set(is_active);
        }
        if let Some(notes) = request.notes {
            session.notes = Set(Some(notes));
        }
        if let Some(breaks) = request.breaks {
            session.breaks = Set(Some(serde_json::to_string(&breaks).unwrap_or_default()));
        }

        session.update(&*self.db).await
    }

    /// Stop a time session
    pub async fn stop_session(
        &self,
        id: &str,
        notes: Option<String>,
    ) -> Result<time_sessions::Model, DbErr> {
        let session = time_sessions::Entity::find_by_id(id)
            .one(&*self.db)
            .await?
            .ok_or_else(|| DbErr::RecordNotFound("Time session not found".to_string()))?;

        let mut session: time_sessions::ActiveModel = session.into();

        session.end_time = Set(Some(chrono::Utc::now()));
        session.is_active = Set(false);

        if let Some(notes) = notes {
            session.notes = Set(Some(notes));
        }

        session.update(&*self.db).await
    }

    /// Pause a time session
    pub async fn pause_session(&self, id: &str) -> Result<time_sessions::Model, DbErr> {
        let session = time_sessions::Entity::find_by_id(id)
            .one(&*self.db)
            .await?
            .ok_or_else(|| DbErr::RecordNotFound("Time session not found".to_string()))?;

        let mut session: time_sessions::ActiveModel = session.into();
        session.is_active = Set(false);

        session.update(&*self.db).await
    }

    /// Resume a time session
    pub async fn resume_session(&self, id: &str) -> Result<time_sessions::Model, DbErr> {
        let session = time_sessions::Entity::find_by_id(id)
            .one(&*self.db)
            .await?
            .ok_or_else(|| DbErr::RecordNotFound("Time session not found".to_string()))?;

        let mut session: time_sessions::ActiveModel = session.into();
        session.is_active = Set(true);

        session.update(&*self.db).await
    }

    /// Delete a time session
    pub async fn delete_session(&self, id: &str) -> Result<(), DbErr> {
        time_sessions::Entity::delete_by_id(id)
            .exec(&*self.db)
            .await?;
        Ok(())
    }

    /// Get time statistics for a date range
    pub async fn get_time_stats(
        &self,
        start_date: chrono::DateTime<chrono::Utc>,
        end_date: chrono::DateTime<chrono::Utc>,
    ) -> Result<TimeStats, DbErr> {
        let sessions = self.find_sessions_between(start_date, end_date).await?;

        let mut total_sessions = 0u64;
        let mut total_time_minutes = 0i64;
        let mut total_break_time_minutes = 0i64;
        let mut hour_counts = vec![0u64; 24];
        let mut day_stats = std::collections::HashMap::new();

        for session in &sessions {
            // Calculate duration for both completed and active sessions
            let end_time = session.end_time.unwrap_or_else(|| chrono::Utc::now());
            let duration = (end_time - session.start_time).num_minutes();
            
            // Only count sessions with meaningful duration (at least 1 minute)
            if duration > 0 {
                // Ensure break time is not negative and not more than total duration
                let break_time_seconds = std::cmp::max(0, session.paused_time) as i64;
                let break_time_minutes = break_time_seconds / 60; // Convert seconds to minutes
                let break_time = std::cmp::min(break_time_minutes, duration); // Cap at total duration
                
                total_sessions += 1;
                total_time_minutes += duration;
                total_break_time_minutes += break_time;

                // Track hourly productivity
                let hour = session.start_time.hour() as usize;
                if hour < 24 {
                    hour_counts[hour] += 1;
                }

                // Track daily stats
                let date = session.start_time.date_naive();
                let day_stat = day_stats.entry(date).or_insert(DayStats {
                    date,
                    total_minutes: 0,
                    session_count: 0,
                });
                day_stat.total_minutes += duration;
                day_stat.session_count += 1;
            }
        }

        let total_work_time_minutes = total_time_minutes - total_break_time_minutes;
        
        let average_session_minutes = if total_sessions > 0 {
            total_time_minutes as f64 / total_sessions as f64
        } else {
            0.0
        };

        let average_productivity_score = if total_time_minutes > 0 {
            (total_work_time_minutes as f64 / total_time_minutes as f64) * 100.0
        } else {
            0.0
        };

        let most_productive_hour = hour_counts
            .iter()
            .enumerate()
            .max_by_key(|(_, &count)| count)
            .map(|(hour, _)| hour as u32);

        let mut sessions_by_day: Vec<DayStats> = day_stats.into_values().collect();
        sessions_by_day.sort_by_key(|stats| stats.date);

        Ok(TimeStats {
            total_sessions,
            total_time_minutes,
            total_work_time_minutes,
            total_break_time_minutes,
            average_session_minutes,
            average_productivity_score,
            most_productive_hour,
            sessions_by_day,
        })
    }

    /// Get total time spent on a task
    pub async fn get_task_total_time(&self, task_id: &str) -> Result<i64, DbErr> {
        let sessions = self.find_sessions_for_task(task_id).await?;

        let total_minutes = sessions
            .iter()
            .filter_map(|session| {
                session.end_time.map(|end_time| {
                    let duration_minutes = (end_time - session.start_time).num_minutes();
                    let paused_minutes = (session.paused_time as i64) / 60; // Convert seconds to minutes
                    duration_minutes - paused_minutes
                })
            })
            .sum();

        Ok(total_minutes)
    }

    /// Get recent sessions (last N sessions)
    pub async fn get_recent_sessions(
        &self,
        limit: u64,
    ) -> Result<Vec<time_sessions::Model>, DbErr> {
        time_sessions::Entity::find()
            .order_by_desc(time_sessions::Column::StartTime)
            .limit(limit)
            .all(&*self.db)
            .await
    }

    /// Get sessions with their associated tasks
    pub async fn get_sessions_with_tasks(
        &self,
        start_date: chrono::DateTime<chrono::Utc>,
        end_date: chrono::DateTime<chrono::Utc>,
    ) -> Result<Vec<(time_sessions::Model, Option<tasks::Model>)>, DbErr> {
        time_sessions::Entity::find()
            .filter(time_sessions::Column::StartTime.between(start_date, end_date))
            .find_also_related(tasks::Entity)
            .order_by_desc(time_sessions::Column::StartTime)
            .all(&*self.db)
            .await
    }

    /// Delete all time sessions
    pub async fn delete_all_sessions(&self) -> Result<u64, DbErr> {
        let result = time_sessions::Entity::delete_many()
            .exec(&*self.db)
            .await?;
        Ok(result.rows_affected)
    }
}
