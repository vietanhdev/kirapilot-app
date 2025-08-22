use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(AiSuggestions::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(AiSuggestions::Id)
                            .string()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(AiSuggestions::Type).string().not_null())
                    .col(ColumnDef::new(AiSuggestions::Title).string().not_null())
                    .col(ColumnDef::new(AiSuggestions::Description).text().not_null())
                    .col(
                        ColumnDef::new(AiSuggestions::Confidence)
                            .double()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(AiSuggestions::Actionable)
                            .boolean()
                            .default(true),
                    )
                    .col(ColumnDef::new(AiSuggestions::Priority).integer().default(1))
                    .col(
                        ColumnDef::new(AiSuggestions::EstimatedImpact)
                            .double()
                            .default(0.0),
                    )
                    .col(ColumnDef::new(AiSuggestions::Reasoning).text().default(""))
                    .col(ColumnDef::new(AiSuggestions::Actions).text().default("[]"))
                    .col(
                        ColumnDef::new(AiSuggestions::CreatedAt)
                            .timestamp()
                            .default(Expr::current_timestamp()),
                    )
                    .col(ColumnDef::new(AiSuggestions::DismissedAt).timestamp())
                    .col(ColumnDef::new(AiSuggestions::AppliedAt).timestamp())
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(AiSuggestions::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum AiSuggestions {
    Table,
    Id,
    Type,
    Title,
    Description,
    Confidence,
    Actionable,
    Priority,
    EstimatedImpact,
    Reasoning,
    Actions,
    CreatedAt,
    DismissedAt,
    AppliedAt,
}
