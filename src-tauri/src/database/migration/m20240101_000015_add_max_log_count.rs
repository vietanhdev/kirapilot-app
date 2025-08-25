use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Add max_log_count column to logging_config table
        manager
            .alter_table(
                Table::alter()
                    .table(LoggingConfig::Table)
                    .add_column(
                        ColumnDef::new(LoggingConfig::MaxLogCount)
                            .integer()
                            .default(10000), // Default to 10,000 logs
                    )
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(LoggingConfig::Table)
                    .drop_column(LoggingConfig::MaxLogCount)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }
}

#[derive(DeriveIden)]
enum LoggingConfig {
    Table,
    MaxLogCount,
}