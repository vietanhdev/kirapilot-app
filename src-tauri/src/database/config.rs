use sea_orm::{ConnectOptions, Database, DatabaseConnection, DbErr};
use std::time::Duration;

/// Database configuration settings
#[derive(Debug, Clone)]
pub struct DatabaseConfig {
    pub database_url: String,
    pub max_connections: u32,
    pub min_connections: u32,
    pub connect_timeout: Duration,
    pub idle_timeout: Duration,
    pub acquire_timeout: Duration,
    pub sqlx_logging: bool,
}

impl Default for DatabaseConfig {
    fn default() -> Self {
        Self {
            database_url: "sqlite:kirapilot.db?mode=rwc".to_string(),
            max_connections: 10,
            min_connections: 1,
            connect_timeout: Duration::from_secs(30),
            idle_timeout: Duration::from_secs(600), // 10 minutes
            acquire_timeout: Duration::from_secs(30),
            sqlx_logging: cfg!(debug_assertions), // Enable logging in debug mode
        }
    }
}

impl DatabaseConfig {
    /// Create a new database configuration
    pub fn new() -> Self {
        Self::default()
    }

    /// Set the database URL
    pub fn with_database_url(mut self, url: String) -> Self {
        self.database_url = url;
        self
    }

    /// Set the maximum number of connections
    pub fn with_max_connections(mut self, max: u32) -> Self {
        self.max_connections = max;
        self
    }

    /// Set the minimum number of connections
    pub fn with_min_connections(mut self, min: u32) -> Self {
        self.min_connections = min;
        self
    }

    /// Enable or disable SQLx logging
    pub fn with_sqlx_logging(mut self, enabled: bool) -> Self {
        self.sqlx_logging = enabled;
        self
    }

    /// Create a database connection with this configuration
    pub async fn connect(&self) -> Result<DatabaseConnection, DbErr> {
        let mut opt = ConnectOptions::new(&self.database_url);

        opt.max_connections(self.max_connections)
            .min_connections(self.min_connections)
            .connect_timeout(self.connect_timeout)
            .idle_timeout(self.idle_timeout)
            .acquire_timeout(self.acquire_timeout)
            .sqlx_logging(self.sqlx_logging);

        Database::connect(opt).await
    }
}

/// Create a database connection with default configuration
pub async fn create_connection() -> Result<DatabaseConnection, DbErr> {
    DatabaseConfig::default().connect().await
}

/// Create a database connection with custom configuration
pub async fn create_connection_with_config(
    config: DatabaseConfig,
) -> Result<DatabaseConnection, DbErr> {
    config.connect().await
}
