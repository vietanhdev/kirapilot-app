use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Create indexes for periodic task templates for better performance
        manager
            .create_index(
                Index::create()
                    .name("idx_periodic_templates_next_generation")
                    .table(PeriodicTaskTemplates::Table)
                    .col(PeriodicTaskTemplates::NextGenerationDate)
                    .col(PeriodicTaskTemplates::IsActive)
                    .if_not_exists()
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_periodic_templates_task_list_id")
                    .table(PeriodicTaskTemplates::Table)
                    .col(PeriodicTaskTemplates::TaskListId)
                    .if_not_exists()
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_periodic_templates_is_active")
                    .table(PeriodicTaskTemplates::Table)
                    .col(PeriodicTaskTemplates::IsActive)
                    .if_not_exists()
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Drop indexes
        manager
            .drop_index(
                Index::drop()
                    .name("idx_periodic_templates_next_generation")
                    .table(PeriodicTaskTemplates::Table)
                    .to_owned(),
            )
            .await?;

        manager
            .drop_index(
                Index::drop()
                    .name("idx_periodic_templates_task_list_id")
                    .table(PeriodicTaskTemplates::Table)
                    .to_owned(),
            )
            .await?;

        manager
            .drop_index(
                Index::drop()
                    .name("idx_periodic_templates_is_active")
                    .table(PeriodicTaskTemplates::Table)
                    .to_owned(),
            )
            .await
    }
}

#[derive(DeriveIden)]
enum PeriodicTaskTemplates {
    Table,
    NextGenerationDate,
    TaskListId,
    IsActive,
}