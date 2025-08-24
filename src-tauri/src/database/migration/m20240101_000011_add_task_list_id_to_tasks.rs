use sea_orm::Statement;
use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Add task_list_id column to tasks table
        manager
            .alter_table(
                Table::alter()
                    .table(Tasks::Table)
                    .add_column(ColumnDef::new(Tasks::TaskListId).string())
                    .to_owned(),
            )
            .await?;

        // Get the default task list ID and update existing tasks
        // We'll use the connection directly for raw SQL since the query builder is complex for this case
        let raw_update_sql = r#"
            UPDATE tasks 
            SET task_list_id = (
                SELECT id FROM task_lists WHERE is_default = 1 LIMIT 1
            ) 
            WHERE task_list_id IS NULL
        "#;

        let update_stmt =
            Statement::from_string(manager.get_database_backend(), raw_update_sql.to_string());

        manager.get_connection().execute(update_stmt).await?;

        // Create index for performance
        manager
            .create_index(
                Index::create()
                    .name("idx_tasks_task_list_id")
                    .table(Tasks::Table)
                    .col(Tasks::TaskListId)
                    .if_not_exists()
                    .to_owned(),
            )
            .await?;

        // Note: SQLite doesn't support adding foreign key constraints to existing tables
        // The foreign key relationship will be enforced at the application level

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Drop index
        manager
            .drop_index(
                Index::drop()
                    .name("idx_tasks_task_list_id")
                    .table(Tasks::Table)
                    .to_owned(),
            )
            .await?;

        // Drop column
        manager
            .alter_table(
                Table::alter()
                    .table(Tasks::Table)
                    .drop_column(Tasks::TaskListId)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }
}

#[derive(DeriveIden)]
enum Tasks {
    Table,
    TaskListId,
}

#[derive(DeriveIden)]
#[allow(dead_code)]
enum TaskLists {
    Table,
    Id,
    IsDefault,
}
