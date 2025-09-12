use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Create threads table
        manager
            .create_table(
                Table::create()
                    .table(Threads::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(Threads::Id).string().not_null().primary_key())
                    .col(ColumnDef::new(Threads::Title).string().not_null())
                    .col(ColumnDef::new(Threads::AssignmentType).string()) // 'task', 'day', 'general'
                    .col(ColumnDef::new(Threads::AssignmentTaskId).string())
                    .col(ColumnDef::new(Threads::AssignmentDate).string()) // ISO string for day assignments
                    .col(ColumnDef::new(Threads::AssignmentContext).text()) // JSON for additional context
                    .col(ColumnDef::new(Threads::MessageCount).integer().default(0))
                    .col(ColumnDef::new(Threads::LastMessageAt).timestamp())
                    .col(
                        ColumnDef::new(Threads::CreatedAt)
                            .timestamp()
                            .default(Expr::current_timestamp())
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(Threads::UpdatedAt)
                            .timestamp()
                            .default(Expr::current_timestamp())
                            .not_null(),
                    )
                    // Foreign key constraint for task assignment
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_threads_assignment_task_id")
                            .from(Threads::Table, Threads::AssignmentTaskId)
                            .to(Tasks::Table, Tasks::Id)
                            .on_delete(ForeignKeyAction::SetNull),
                    )
                    .to_owned(),
            )
            .await?;

        // Create thread_messages table
        manager
            .create_table(
                Table::create()
                    .table(ThreadMessages::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(ThreadMessages::Id).string().not_null().primary_key())
                    .col(ColumnDef::new(ThreadMessages::ThreadId).string().not_null())
                    .col(ColumnDef::new(ThreadMessages::Type).string().not_null()) // 'user' or 'assistant'
                    .col(ColumnDef::new(ThreadMessages::Content).text().not_null())
                    .col(ColumnDef::new(ThreadMessages::Reasoning).text())
                    .col(ColumnDef::new(ThreadMessages::Actions).text()) // JSON serialized AIAction[]
                    .col(ColumnDef::new(ThreadMessages::Suggestions).text()) // JSON serialized AISuggestion[]
                    .col(ColumnDef::new(ThreadMessages::ToolExecutions).text()) // JSON serialized ToolExecution[]
                    .col(ColumnDef::new(ThreadMessages::UserFeedback).text()) // JSON serialized UserFeedback
                    .col(ColumnDef::new(ThreadMessages::Timestamp).timestamp().not_null())
                    .col(
                        ColumnDef::new(ThreadMessages::CreatedAt)
                            .timestamp()
                            .default(Expr::current_timestamp())
                            .not_null(),
                    )
                    // Foreign key constraint for thread
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_thread_messages_thread_id")
                            .from(ThreadMessages::Table, ThreadMessages::ThreadId)
                            .to(Threads::Table, Threads::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // Create indexes for better performance
        manager
            .create_index(
                Index::create()
                    .name("idx_threads_assignment_task_id")
                    .table(Threads::Table)
                    .col(Threads::AssignmentTaskId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_threads_assignment_type")
                    .table(Threads::Table)
                    .col(Threads::AssignmentType)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_threads_created_at")
                    .table(Threads::Table)
                    .col(Threads::CreatedAt)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_thread_messages_thread_id")
                    .table(ThreadMessages::Table)
                    .col(ThreadMessages::ThreadId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_thread_messages_timestamp")
                    .table(ThreadMessages::Table)
                    .col(ThreadMessages::Timestamp)
                    .to_owned(),
            )
            .await

    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Drop indexes first
        manager
            .drop_index(
                Index::drop()
                    .name("idx_thread_messages_timestamp")
                    .to_owned(),
            )
            .await?;

        manager
            .drop_index(
                Index::drop()
                    .name("idx_thread_messages_thread_id")
                    .to_owned(),
            )
            .await?;

        manager
            .drop_index(
                Index::drop()
                    .name("idx_threads_created_at")
                    .to_owned(),
            )
            .await?;

        manager
            .drop_index(
                Index::drop()
                    .name("idx_threads_assignment_type")
                    .to_owned(),
            )
            .await?;

        manager
            .drop_index(
                Index::drop()
                    .name("idx_threads_assignment_task_id")
                    .to_owned(),
            )
            .await?;

        // Drop tables
        manager
            .drop_table(Table::drop().table(ThreadMessages::Table).to_owned())
            .await?;

        manager
            .drop_table(Table::drop().table(Threads::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum Threads {
    Table,
    Id,
    Title,
    AssignmentType,
    AssignmentTaskId,
    AssignmentDate,
    AssignmentContext,
    MessageCount,
    LastMessageAt,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum ThreadMessages {
    Table,
    Id,
    ThreadId,
    Type,
    Content,
    Reasoning,
    Actions,
    Suggestions,
    ToolExecutions,
    UserFeedback,
    Timestamp,
    CreatedAt,
}

// Reference to existing Tasks table for foreign key
#[derive(DeriveIden)]
enum Tasks {
    Table,
    Id,
}