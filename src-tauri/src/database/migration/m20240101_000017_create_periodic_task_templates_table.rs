use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(PeriodicTaskTemplates::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(PeriodicTaskTemplates::Id)
                            .string()
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(PeriodicTaskTemplates::Title)
                            .string()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(PeriodicTaskTemplates::Description)
                            .text()
                            .default(""),
                    )
                    .col(
                        ColumnDef::new(PeriodicTaskTemplates::Priority)
                            .integer()
                            .not_null()
                            .default(1),
                    )
                    .col(
                        ColumnDef::new(PeriodicTaskTemplates::TimeEstimate)
                            .integer()
                            .not_null()
                            .default(0),
                    )
                    .col(
                        ColumnDef::new(PeriodicTaskTemplates::Tags)
                            .text()
                            .default("[]"),
                    )
                    .col(ColumnDef::new(PeriodicTaskTemplates::TaskListId).string())
                    .col(
                        ColumnDef::new(PeriodicTaskTemplates::RecurrenceType)
                            .string()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(PeriodicTaskTemplates::RecurrenceInterval)
                            .integer()
                            .not_null()
                            .default(1),
                    )
                    .col(ColumnDef::new(PeriodicTaskTemplates::RecurrenceUnit).string())
                    .col(
                        ColumnDef::new(PeriodicTaskTemplates::StartDate)
                            .timestamp()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(PeriodicTaskTemplates::NextGenerationDate)
                            .timestamp()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(PeriodicTaskTemplates::IsActive)
                            .boolean()
                            .not_null()
                            .default(true),
                    )
                    .col(
                        ColumnDef::new(PeriodicTaskTemplates::CreatedAt)
                            .timestamp()
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        ColumnDef::new(PeriodicTaskTemplates::UpdatedAt)
                            .timestamp()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_periodic_task_templates_task_list_id")
                            .from(PeriodicTaskTemplates::Table, PeriodicTaskTemplates::TaskListId)
                            .to(TaskLists::Table, TaskLists::Id)
                            .on_delete(ForeignKeyAction::SetNull),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(PeriodicTaskTemplates::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum PeriodicTaskTemplates {
    Table,
    Id,
    Title,
    Description,
    Priority,
    TimeEstimate,
    Tags,
    TaskListId,
    RecurrenceType,
    RecurrenceInterval,
    RecurrenceUnit,
    StartDate,
    NextGenerationDate,
    IsActive,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum TaskLists {
    Table,
    Id,
}