use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(TimeSessions::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(TimeSessions::Id)
                            .string()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(TimeSessions::TaskId).string().not_null())
                    .col(
                        ColumnDef::new(TimeSessions::StartTime)
                            .timestamp()
                            .not_null(),
                    )
                    .col(ColumnDef::new(TimeSessions::EndTime).timestamp())
                    .col(
                        ColumnDef::new(TimeSessions::PausedTime)
                            .integer()
                            .default(0),
                    )
                    .col(
                        ColumnDef::new(TimeSessions::IsActive)
                            .boolean()
                            .default(false),
                    )
                    .col(ColumnDef::new(TimeSessions::Notes).text().default(""))
                    .col(ColumnDef::new(TimeSessions::Breaks).text().default("[]"))
                    .col(
                        ColumnDef::new(TimeSessions::CreatedAt)
                            .timestamp()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_time_sessions_task_id")
                            .from(TimeSessions::Table, TimeSessions::TaskId)
                            .to(Tasks::Table, Tasks::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(TimeSessions::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum TimeSessions {
    Table,
    Id,
    TaskId,
    StartTime,
    EndTime,
    PausedTime,
    IsActive,
    Notes,
    Breaks,
    CreatedAt,
}

#[derive(DeriveIden)]
enum Tasks {
    Table,
    Id,
}
