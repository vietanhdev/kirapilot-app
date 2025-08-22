use sea_orm::DbErr;
use serde::{Deserialize, Serialize};

/// Custom database error types for better error handling
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DatabaseError {
    /// Connection related errors
    ConnectionError(String),
    /// Migration related errors
    MigrationError(String),
    /// Query execution errors
    QueryError(String),
    /// Entity not found errors
    NotFound(String),
    /// Validation errors
    ValidationError(String),
    /// Transaction errors
    TransactionError(String),
    /// Generic database errors
    DatabaseError(String),
}

impl std::fmt::Display for DatabaseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DatabaseError::ConnectionError(msg) => write!(f, "Connection error: {}", msg),
            DatabaseError::MigrationError(msg) => write!(f, "Migration error: {}", msg),
            DatabaseError::QueryError(msg) => write!(f, "Query error: {}", msg),
            DatabaseError::NotFound(msg) => write!(f, "Not found: {}", msg),
            DatabaseError::ValidationError(msg) => write!(f, "Validation error: {}", msg),
            DatabaseError::TransactionError(msg) => write!(f, "Transaction error: {}", msg),
            DatabaseError::DatabaseError(msg) => write!(f, "Database error: {}", msg),
        }
    }
}

impl std::error::Error for DatabaseError {}

impl From<DbErr> for DatabaseError {
    fn from(err: DbErr) -> Self {
        match err {
            DbErr::ConnectionAcquire(e) => DatabaseError::ConnectionError(e.to_string()),
            DbErr::Migration(e) => DatabaseError::MigrationError(e),
            DbErr::Exec(e) => DatabaseError::QueryError(e.to_string()),
            DbErr::Query(e) => DatabaseError::QueryError(e.to_string()),
            DbErr::RecordNotFound(e) => DatabaseError::NotFound(e),
            DbErr::Custom(e) => DatabaseError::ValidationError(e),
            _ => DatabaseError::DatabaseError(err.to_string()),
        }
    }
}

/// Result type alias for database operations
pub type DatabaseResult<T> = Result<T, DatabaseError>;

/// Convert DatabaseError to a string for Tauri commands
impl From<DatabaseError> for String {
    fn from(err: DatabaseError) -> Self {
        err.to_string()
    }
}
