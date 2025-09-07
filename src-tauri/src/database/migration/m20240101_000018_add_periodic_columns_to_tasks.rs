use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Add periodic_template_id column
        manager
            .alter_table(
                Table::alter()
                    .table(Tasks::Table)
                    .add_column(ColumnDef::new(Tasks::PeriodicTemplateId).string())
                    .to_owned(),
            )
            .await?;

        // Add is_periodic_instance column
        manager
            .alter_table(
                Table::alter()
                    .table(Tasks::Table)
                    .add_column(
                        ColumnDef::new(Tasks::IsPeriodicInstance)
                            .boolean()
                            .default(false),
                    )
                    .to_owned(),
            )
            .await?;

        // Add generation_date column
        manager
            .alter_table(
                Table::alter()
                    .table(Tasks::Table)
                    .add_column(ColumnDef::new(Tasks::GenerationDate).timestamp())
                    .to_owned(),
            )
            .await?;

        // Create indexes for performance
        manager
            .create_index(
                Index::create()
                    .name("idx_tasks_periodic_template_id")
                    .table(Tasks::Table)
                    .col(Tasks::PeriodicTemplateId)
                    .if_not_exists()
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_tasks_is_periodic_instance")
                    .table(Tasks::Table)
                    .col(Tasks::IsPeriodicInstance)
                    .if_not_exists()
                    .to_owned(),
            )
            .await

        // Note: SQLite doesn't support adding foreign key constraints to existing tables
        // The foreign key relationship will be enforced at the application level
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Drop indexes first
        manager
            .drop_index(
                Index::drop()
                    .name("idx_tasks_periodic_template_id")
                    .table(Tasks::Table)
                    .to_owned(),
            )
            .await?;

        manager
            .drop_index(
                Index::drop()
                    .name("idx_tasks_is_periodic_instance")
                    .table(Tasks::Table)
                    .to_owned(),
            )
            .await?;

        // Drop columns
        manager
            .alter_table(
                Table::alter()
                    .table(Tasks::Table)
                    .drop_column(Tasks::PeriodicTemplateId)
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Tasks::Table)
                    .drop_column(Tasks::IsPeriodicInstance)
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Tasks::Table)
                    .drop_column(Tasks::GenerationDate)
                    .to_owned(),
            )
            .await
    }
}

#[derive(DeriveIden)]
enum Tasks {
    Table,
    PeriodicTemplateId,
    IsPeriodicInstance,
    GenerationDate,
}

