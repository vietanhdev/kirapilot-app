use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(AiInteractions::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(AiInteractions::Id)
                            .string()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(AiInteractions::Message).text().not_null())
                    .col(ColumnDef::new(AiInteractions::Response).text().not_null())
                    .col(ColumnDef::new(AiInteractions::ActionTaken).text())
                    .col(ColumnDef::new(AiInteractions::Reasoning).text())
                    .col(
                        ColumnDef::new(AiInteractions::ToolsUsed)
                            .text()
                            .default("[]"),
                    )
                    .col(ColumnDef::new(AiInteractions::Confidence).double())
                    .col(
                        ColumnDef::new(AiInteractions::CreatedAt)
                            .timestamp()
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(AiInteractions::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum AiInteractions {
    Table,
    Id,
    Message,
    Response,
    ActionTaken,
    Reasoning,
    ToolsUsed,
    Confidence,
    CreatedAt,
}
