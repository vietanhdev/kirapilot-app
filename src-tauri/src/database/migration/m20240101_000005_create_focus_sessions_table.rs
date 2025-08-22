use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(FocusSessions::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(FocusSessions::Id)
                            .string()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(FocusSessions::TaskId).string().not_null())
                    .col(
                        ColumnDef::new(FocusSessions::PlannedDuration)
                            .integer()
                            .not_null(),
                    )
                    .col(ColumnDef::new(FocusSessions::ActualDuration).integer())
                    .col(ColumnDef::new(FocusSessions::FocusScore).double())
                    .col(
                        ColumnDef::new(FocusSessions::DistractionCount)
                            .integer()
                            .default(0),
                    )
                    .col(
                        ColumnDef::new(FocusSessions::DistractionLevel)
                            .string()
                            .default("moderate"),
                    )
                    .col(ColumnDef::new(FocusSessions::BackgroundAudio).string())
                    .col(ColumnDef::new(FocusSessions::Notes).text().default(""))
                    .col(ColumnDef::new(FocusSessions::Breaks).text().default("[]"))
                    .col(ColumnDef::new(FocusSessions::Metrics).text().default("{}"))
                    .col(
                        ColumnDef::new(FocusSessions::CreatedAt)
                            .timestamp()
                            .default(Expr::current_timestamp()),
                    )
                    .col(ColumnDef::new(FocusSessions::CompletedAt).timestamp())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_focus_sessions_task_id")
                            .from(FocusSessions::Table, FocusSessions::TaskId)
                            .to(Tasks::Table, Tasks::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(FocusSessions::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum FocusSessions {
    Table,
    Id,
    TaskId,
    PlannedDuration,
    ActualDuration,
    FocusScore,
    DistractionCount,
    DistractionLevel,
    BackgroundAudio,
    Notes,
    Breaks,
    Metrics,
    CreatedAt,
    CompletedAt,
}

#[derive(DeriveIden)]
enum Tasks {
    Table,
    Id,
}
