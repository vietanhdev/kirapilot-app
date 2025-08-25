use sea_orm::{ConnectOptions, Database, DatabaseConnection, DbErr};
use std::time::Duration;
use std::path::PathBuf;

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
        let database_url = get_database_path()
            .map(|path| format!("sqlite:{}?mode=rwc", path.display()))
            .unwrap_or_else(|_| "sqlite:kirapilot.db?mode=rwc".to_string());

        Self {
            database_url,
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
    #[allow(dead_code)]
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
#[allow(dead_code)]
pub async fn create_connection() -> Result<DatabaseConnection, DbErr> {
    DatabaseConfig::default().connect().await
}

/// Create a database connection with custom configuration
pub async fn create_connection_with_config(
    config: DatabaseConfig,
) -> Result<DatabaseConnection, DbErr> {
    config.connect().await
}

/// Get the proper database path in the application data directory
fn get_database_path() -> Result<PathBuf, std::io::Error> {
    let app_data_dir = if cfg!(target_os = "macos") {
        dirs::data_local_dir()
            .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "Cannot find local data directory"))?
            .join("KiraPilot")
    } else if cfg!(target_os = "windows") {
        dirs::data_local_dir()
            .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "Cannot find local data directory"))?
            .join("KiraPilot")
    } else {
        // Linux and other Unix-like systems
        dirs::data_local_dir()
            .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "Cannot find local data directory"))?
            .join("kirapilot")
    };

    // Create the directory if it doesn't exist
    std::fs::create_dir_all(&app_data_dir)?;

    Ok(app_data_dir.join("kirapilot.db"))
}
