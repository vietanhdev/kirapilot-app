use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Create comprehensive AI interaction logs table
        manager
            .create_table(
                Table::create()
                    .table(AiInteractionLogs::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(AiInteractionLogs::Id)
                            .string()
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(AiInteractionLogs::Timestamp)
                            .timestamp()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(AiInteractionLogs::SessionId)
                            .string()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(AiInteractionLogs::ModelType)
                            .string()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(AiInteractionLogs::ModelInfo)
                            .text()
                            .not_null(),
                    )
                    // Request data
                    .col(
                        ColumnDef::new(AiInteractionLogs::UserMessage)
                            .text()
                            .not_null(),
                    )
                    .col(ColumnDef::new(AiInteractionLogs::SystemPrompt).text())
                    .col(
                        ColumnDef::new(AiInteractionLogs::Context)
                            .text()
                            .not_null(),
                    )
                    // Response data
                    .col(
                        ColumnDef::new(AiInteractionLogs::AiResponse)
                            .text()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(AiInteractionLogs::Actions)
                            .text()
                            .default("[]"),
                    )
                    .col(
                        ColumnDef::new(AiInteractionLogs::Suggestions)
                            .text()
                            .default("[]"),
                    )
                    .col(ColumnDef::new(AiInteractionLogs::Reasoning).text())
                    // Performance metrics
                    .col(
                        ColumnDef::new(AiInteractionLogs::ResponseTime)
                            .integer()
                            .not_null(),
                    )
                    .col(ColumnDef::new(AiInteractionLogs::TokenCount).integer())
                    // Error information
                    .col(ColumnDef::new(AiInteractionLogs::Error).text())
                    .col(ColumnDef::new(AiInteractionLogs::ErrorCode).string())
                    // Privacy flags
                    .col(
                        ColumnDef::new(AiInteractionLogs::ContainsSensitiveData)
                            .boolean()
                            .default(false),
                    )
                    .col(
                        ColumnDef::new(AiInteractionLogs::DataClassification)
                            .string()
                            .default("internal"),
                    )
                    // Metadata
                    .col(
                        ColumnDef::new(AiInteractionLogs::CreatedAt)
                            .timestamp()
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        ColumnDef::new(AiInteractionLogs::UpdatedAt)
                            .timestamp()
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await?;

        // Create tool execution logs table
        manager
            .create_table(
                Table::create()
                    .table(ToolExecutionLogs::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(ToolExecutionLogs::Id)
                            .string()
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(ToolExecutionLogs::InteractionLogId)
                            .string()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(ToolExecutionLogs::ToolName)
                            .string()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(ToolExecutionLogs::Arguments)
                            .text()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(ToolExecutionLogs::Result)
                            .text()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(ToolExecutionLogs::ExecutionTime)
                            .integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(ToolExecutionLogs::Success)
                            .boolean()
                            .not_null(),
                    )
                    .col(ColumnDef::new(ToolExecutionLogs::Error).text())
                    .col(
                        ColumnDef::new(ToolExecutionLogs::CreatedAt)
                            .timestamp()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_tool_execution_logs_interaction_log_id")
                            .from(ToolExecutionLogs::Table, ToolExecutionLogs::InteractionLogId)
                            .to(AiInteractionLogs::Table, AiInteractionLogs::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // Create logging configuration table
        manager
            .create_table(
                Table::create()
                    .table(LoggingConfig::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(LoggingConfig::Id)
                            .integer()
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(LoggingConfig::Enabled)
                            .boolean()
                            .default(false),
                    )
                    .col(
                        ColumnDef::new(LoggingConfig::LogLevel)
                            .string()
                            .default("standard"),
                    )
                    .col(
                        ColumnDef::new(LoggingConfig::RetentionDays)
                            .integer()
                            .default(30),
                    )
                    .col(
                        ColumnDef::new(LoggingConfig::MaxLogSize)
                            .integer()
                            .default(10485760), // 10MB
                    )
                    .col(
                        ColumnDef::new(LoggingConfig::IncludeSystemPrompts)
                            .boolean()
                            .default(true),
                    )
                    .col(
                        ColumnDef::new(LoggingConfig::IncludeToolExecutions)
                            .boolean()
                            .default(true),
                    )
                    .col(
                        ColumnDef::new(LoggingConfig::IncludePerformanceMetrics)
                            .boolean()
                            .default(true),
                    )
                    .col(
                        ColumnDef::new(LoggingConfig::AutoCleanup)
                            .boolean()
                            .default(true),
                    )
                    .col(
                        ColumnDef::new(LoggingConfig::ExportFormat)
                            .string()
                            .default("json"),
                    )
                    .col(
                        ColumnDef::new(LoggingConfig::CreatedAt)
                            .timestamp()
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        ColumnDef::new(LoggingConfig::UpdatedAt)
                            .timestamp()
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await?;

        // Create indexes for performance
        manager
            .create_index(
                Index::create()
                    .name("idx_ai_interaction_logs_timestamp")
                    .table(AiInteractionLogs::Table)
                    .col(AiInteractionLogs::Timestamp)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_ai_interaction_logs_model_type")
                    .table(AiInteractionLogs::Table)
                    .col(AiInteractionLogs::ModelType)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_ai_interaction_logs_session_id")
                    .table(AiInteractionLogs::Table)
                    .col(AiInteractionLogs::SessionId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_tool_execution_logs_interaction_id")
                    .table(ToolExecutionLogs::Table)
                    .col(ToolExecutionLogs::InteractionLogId)
                    .to_owned(),
            )
            .await?;

        // Insert default logging configuration
        manager
            .exec_stmt(
                Query::insert()
                    .into_table(LoggingConfig::Table)
                    .columns([LoggingConfig::Id])
                    .values_panic([1.into()])
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(ToolExecutionLogs::Table).to_owned())
            .await?;

        manager
            .drop_table(Table::drop().table(AiInteractionLogs::Table).to_owned())
            .await?;

        manager
            .drop_table(Table::drop().table(LoggingConfig::Table).to_owned())
            .await?;

        Ok(())
    }
}

#[derive(DeriveIden)]
enum AiInteractionLogs {
    Table,
    Id,
    Timestamp,
    SessionId,
    ModelType,
    ModelInfo,
    UserMessage,
    SystemPrompt,
    Context,
    AiResponse,
    Actions,
    Suggestions,
    Reasoning,
    ResponseTime,
    TokenCount,
    Error,
    ErrorCode,
    ContainsSensitiveData,
    DataClassification,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum ToolExecutionLogs {
    Table,
    Id,
    InteractionLogId,
    ToolName,
    Arguments,
    Result,
    ExecutionTime,
    Success,
    Error,
    CreatedAt,
}

#[derive(DeriveIden)]
enum LoggingConfig {
    Table,
    Id,
    Enabled,
    LogLevel,
    RetentionDays,
    MaxLogSize,
    IncludeSystemPrompts,
    IncludeToolExecutions,
    IncludePerformanceMetrics,
    AutoCleanup,
    ExportFormat,
    CreatedAt,
    UpdatedAt,
}