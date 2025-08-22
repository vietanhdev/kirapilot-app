use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Tasks::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(Tasks::Id).string().not_null().primary_key())
                    .col(ColumnDef::new(Tasks::Title).string().not_null())
                    .col(ColumnDef::new(Tasks::Description).text().default(""))
                    .col(ColumnDef::new(Tasks::Priority).integer().default(1))
                    .col(ColumnDef::new(Tasks::Status).string().default("pending"))
                    .col(ColumnDef::new(Tasks::Dependencies).text().default("[]"))
                    .col(ColumnDef::new(Tasks::TimeEstimate).integer().default(0))
                    .col(ColumnDef::new(Tasks::ActualTime).integer().default(0))
                    .col(ColumnDef::new(Tasks::DueDate).timestamp())
                    .col(ColumnDef::new(Tasks::ScheduledDate).timestamp())
                    .col(ColumnDef::new(Tasks::Tags).text().default("[]"))
                    .col(ColumnDef::new(Tasks::ProjectId).string())
                    .col(ColumnDef::new(Tasks::ParentTaskId).string())
                    .col(ColumnDef::new(Tasks::Subtasks).text().default("[]"))
                    .col(ColumnDef::new(Tasks::CompletedAt).timestamp())
                    .col(
                        ColumnDef::new(Tasks::CreatedAt)
                            .timestamp()
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        ColumnDef::new(Tasks::UpdatedAt)
                            .timestamp()
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Tasks::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum Tasks {
    Table,
    Id,
    Title,
    Description,
    Priority,
    Status,
    Dependencies,
    TimeEstimate,
    ActualTime,
    DueDate,
    ScheduledDate,
    Tags,
    ProjectId,
    ParentTaskId,
    Subtasks,
    CompletedAt,
    CreatedAt,
    UpdatedAt,
}
