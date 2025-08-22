use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Tasks table indexes
        manager
            .create_index(
                Index::create()
                    .name("idx_tasks_status")
                    .table(Tasks::Table)
                    .col(Tasks::Status)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_tasks_priority")
                    .table(Tasks::Table)
                    .col(Tasks::Priority)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_tasks_due_date")
                    .table(Tasks::Table)
                    .col(Tasks::DueDate)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_tasks_scheduled_date")
                    .table(Tasks::Table)
                    .col(Tasks::ScheduledDate)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_tasks_created_at")
                    .table(Tasks::Table)
                    .col(Tasks::CreatedAt)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_tasks_parent_task_id")
                    .table(Tasks::Table)
                    .col(Tasks::ParentTaskId)
                    .to_owned(),
            )
            .await?;

        // Task dependencies indexes
        manager
            .create_index(
                Index::create()
                    .name("idx_task_dependencies_task_id")
                    .table(TaskDependencies::Table)
                    .col(TaskDependencies::TaskId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_task_dependencies_depends_on_id")
                    .table(TaskDependencies::Table)
                    .col(TaskDependencies::DependsOnId)
                    .to_owned(),
            )
            .await?;

        // Time sessions indexes
        manager
            .create_index(
                Index::create()
                    .name("idx_time_sessions_task_id")
                    .table(TimeSessions::Table)
                    .col(TimeSessions::TaskId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_time_sessions_start_time")
                    .table(TimeSessions::Table)
                    .col(TimeSessions::StartTime)
                    .to_owned(),
            )
            .await?;

        // Focus sessions indexes
        manager
            .create_index(
                Index::create()
                    .name("idx_focus_sessions_task_id")
                    .table(FocusSessions::Table)
                    .col(FocusSessions::TaskId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_focus_sessions_created_at")
                    .table(FocusSessions::Table)
                    .col(FocusSessions::CreatedAt)
                    .to_owned(),
            )
            .await?;

        // Productivity patterns indexes
        manager
            .create_index(
                Index::create()
                    .name("idx_productivity_patterns_user_id")
                    .table(ProductivityPatterns::Table)
                    .col(ProductivityPatterns::UserId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_productivity_patterns_pattern_type")
                    .table(ProductivityPatterns::Table)
                    .col(ProductivityPatterns::PatternType)
                    .to_owned(),
            )
            .await?;

        // AI suggestions indexes
        manager
            .create_index(
                Index::create()
                    .name("idx_ai_suggestions_type")
                    .table(AiSuggestions::Table)
                    .col(AiSuggestions::Type)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_ai_suggestions_created_at")
                    .table(AiSuggestions::Table)
                    .col(AiSuggestions::CreatedAt)
                    .to_owned(),
            )
            .await?;

        // AI interactions indexes
        manager
            .create_index(
                Index::create()
                    .name("idx_ai_interactions_created_at")
                    .table(AiInteractions::Table)
                    .col(AiInteractions::CreatedAt)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Drop all indexes in reverse order
        let indexes = vec![
            "idx_ai_interactions_created_at",
            "idx_ai_suggestions_created_at",
            "idx_ai_suggestions_type",
            "idx_productivity_patterns_pattern_type",
            "idx_productivity_patterns_user_id",
            "idx_focus_sessions_created_at",
            "idx_focus_sessions_task_id",
            "idx_time_sessions_start_time",
            "idx_time_sessions_task_id",
            "idx_task_dependencies_depends_on_id",
            "idx_task_dependencies_task_id",
            "idx_tasks_parent_task_id",
            "idx_tasks_created_at",
            "idx_tasks_scheduled_date",
            "idx_tasks_due_date",
            "idx_tasks_priority",
            "idx_tasks_status",
        ];

        for index_name in indexes {
            manager
                .drop_index(Index::drop().name(index_name).to_owned())
                .await?;
        }

        Ok(())
    }
}

#[derive(DeriveIden)]
enum Tasks {
    Table,
    Status,
    Priority,
    DueDate,
    ScheduledDate,
    CreatedAt,
    ParentTaskId,
}

#[derive(DeriveIden)]
enum TaskDependencies {
    Table,
    TaskId,
    DependsOnId,
}

#[derive(DeriveIden)]
enum TimeSessions {
    Table,
    TaskId,
    StartTime,
}

#[derive(DeriveIden)]
enum FocusSessions {
    Table,
    TaskId,
    CreatedAt,
}

#[derive(DeriveIden)]
enum ProductivityPatterns {
    Table,
    UserId,
    PatternType,
}

#[derive(DeriveIden)]
enum AiSuggestions {
    Table,
    Type,
    CreatedAt,
}

#[derive(DeriveIden)]
enum AiInteractions {
    Table,
    CreatedAt,
}
