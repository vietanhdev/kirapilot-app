use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(UserPreferences::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(UserPreferences::Id).string().not_null().primary_key().default("default"))
                    .col(ColumnDef::new(UserPreferences::WorkingHours).text().not_null().default(r#"{"start":"09:00","end":"17:00"}"#))
                    .col(ColumnDef::new(UserPreferences::BreakPreferences).text().not_null().default(r#"{"shortBreakDuration":5,"longBreakDuration":30,"breakInterval":60}"#))
                    .col(ColumnDef::new(UserPreferences::FocusPreferences).text().not_null().default(r#"{"defaultDuration":45,"distractionLevel":"moderate","backgroundAudio":{"type":"silence","volume":0}}"#))
                    .col(ColumnDef::new(UserPreferences::Notifications).text().not_null().default(r#"{"breakReminders":true,"taskDeadlines":true,"dailySummary":false,"weeklyReview":true}"#))
                    .col(ColumnDef::new(UserPreferences::Theme).string().default("auto"))
                    .col(ColumnDef::new(UserPreferences::Language).string().default("en"))
                    .col(ColumnDef::new(UserPreferences::CreatedAt).timestamp().default(Expr::current_timestamp()))
                    .col(ColumnDef::new(UserPreferences::UpdatedAt).timestamp().default(Expr::current_timestamp()))
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(UserPreferences::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum UserPreferences {
    Table,
    Id,
    WorkingHours,
    BreakPreferences,
    FocusPreferences,
    Notifications,
    Theme,
    Language,
    CreatedAt,
    UpdatedAt,
}
