use sea_orm::Value;
use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(TaskLists::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(TaskLists::Id)
                            .string()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(TaskLists::Name).string().not_null())
                    .col(
                        ColumnDef::new(TaskLists::IsDefault)
                            .boolean()
                            .not_null()
                            .default(false),
                    )
                    .col(
                        ColumnDef::new(TaskLists::CreatedAt)
                            .timestamp()
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        ColumnDef::new(TaskLists::UpdatedAt)
                            .timestamp()
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await?;

        // Create unique index to ensure only one default task list
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

        // Insert the default task list
        let insert_stmt = Query::insert()
            .into_table(TaskLists::Table)
            .columns([
                TaskLists::Id,
                TaskLists::Name,
                TaskLists::IsDefault,
                TaskLists::CreatedAt,
                TaskLists::UpdatedAt,
            ])
            .values_panic([
                SimpleExpr::Value(Value::String(Some(Box::new(
                    uuid::Uuid::new_v4().to_string(),
                )))),
                SimpleExpr::Value(Value::String(Some(Box::new("Default".to_string())))),
                SimpleExpr::Value(Value::Bool(Some(true))),
                Expr::current_timestamp().into(),
                Expr::current_timestamp().into(),
            ])
            .to_owned();

        manager.exec_stmt(insert_stmt).await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(TaskLists::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum TaskLists {
    Table,
    Id,
    Name,
    IsDefault,
    CreatedAt,
    UpdatedAt,
}
