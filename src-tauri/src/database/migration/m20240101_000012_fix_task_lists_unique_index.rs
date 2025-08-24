use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Drop the problematic unique index that prevents multiple non-default task lists
        manager
            .drop_index(
                Index::drop()
                    .name("idx_task_lists_default_unique")
                    .table(TaskLists::Table)
                    .to_owned(),
            )
            .await?;

        // Create a partial unique index that only enforces uniqueness for default task lists
        // This allows multiple task lists with is_default = false, but only one with is_default = true
        let create_partial_index_sql = r#"
            CREATE UNIQUE INDEX idx_task_lists_default_unique_partial 
            ON task_lists (is_default) 
            WHERE is_default = true
        "#;

        manager
            .get_connection()
            .execute_unprepared(create_partial_index_sql)
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Drop the partial unique index
        manager
            .get_connection()
            .execute_unprepared("DROP INDEX IF EXISTS idx_task_lists_default_unique_partial")
            .await?;

        // Recreate the original (problematic) unique index
        manager
            .create_index(
                Index::create()
                    .name("idx_task_lists_default_unique")
                    .table(TaskLists::Table)
                    .col(TaskLists::IsDefault)
                    .unique()
                    .if_not_exists()
                    .to_owned(),
            )
            .await?;

        Ok(())
    }
}

#[derive(DeriveIden)]
enum TaskLists {
    Table,
    IsDefault,
}