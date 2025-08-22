use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(TaskDependencies::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(TaskDependencies::Id)
                            .string()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(TaskDependencies::TaskId).string().not_null())
                    .col(
                        ColumnDef::new(TaskDependencies::DependsOnId)
                            .string()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(TaskDependencies::CreatedAt)
                            .timestamp()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_task_dependencies_task_id")
                            .from(TaskDependencies::Table, TaskDependencies::TaskId)
                            .to(Tasks::Table, Tasks::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_task_dependencies_depends_on_id")
                            .from(TaskDependencies::Table, TaskDependencies::DependsOnId)
                            .to(Tasks::Table, Tasks::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // Add unique constraint
        manager
            .create_index(
                Index::create()
                    .name("idx_task_dependencies_unique")
                    .table(TaskDependencies::Table)
                    .col(TaskDependencies::TaskId)
                    .col(TaskDependencies::DependsOnId)
                    .unique()
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(TaskDependencies::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum TaskDependencies {
    Table,
    Id,
    TaskId,
    DependsOnId,
    CreatedAt,
}

#[derive(DeriveIden)]
enum Tasks {
    Table,
    Id,
}
