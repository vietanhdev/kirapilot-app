use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(ProductivityPatterns::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(ProductivityPatterns::Id)
                            .string()
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(ProductivityPatterns::UserId)
                            .string()
                            .not_null()
                            .default("default"),
                    )
                    .col(
                        ColumnDef::new(ProductivityPatterns::PatternType)
                            .string()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(ProductivityPatterns::TimeSlot)
                            .string()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(ProductivityPatterns::ProductivityScore)
                            .double()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(ProductivityPatterns::ConfidenceLevel)
                            .double()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(ProductivityPatterns::SampleSize)
                            .integer()
                            .default(1),
                    )
                    .col(
                        ColumnDef::new(ProductivityPatterns::CreatedAt)
                            .timestamp()
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        ColumnDef::new(ProductivityPatterns::UpdatedAt)
                            .timestamp()
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(ProductivityPatterns::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum ProductivityPatterns {
    Table,
    Id,
    UserId,
    PatternType,
    TimeSlot,
    ProductivityScore,
    ConfidenceLevel,
    SampleSize,
    CreatedAt,
    UpdatedAt,
}
