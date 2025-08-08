// Database service for KiraPilot using Tauri SQL plugin
import Database from '@tauri-apps/plugin-sql';

let db: Database | null = null;

/**
 * Initialize the database connection
 */
export async function initializeDatabase(): Promise<Database> {
  if (db) {
    return db;
  }

  try {
    // Create or connect to SQLite database
    db = await Database.load('sqlite:kirapilot.db');
    
    // Run migrations
    await runMigrations(db);
    
    console.log('Database initialized successfully');
    return db;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Get the database instance
 */
export async function getDatabase(): Promise<Database> {
  if (!db) {
    return await initializeDatabase();
  }
  return db;
}

/**
 * Close the database connection
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
  }
}

/**
 * Run database migrations
 */
async function runMigrations(database: Database): Promise<void> {
  console.log('Running database migrations...');
  
  // Create migrations table if it doesn't exist
  await database.execute(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version TEXT UNIQUE NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Get current migration version
  const currentMigrations = await database.select<{ version: string }[]>(
    'SELECT version FROM migrations ORDER BY version DESC LIMIT 1'
  );
  
  const currentVersion = currentMigrations.length > 0 ? currentMigrations[0].version : '0';
  
  // Apply migrations in order
  const migrations = getMigrations();
  
  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      console.log(`Applying migration ${migration.version}: ${migration.description}`);
      
      try {
        // Execute migration
        for (const statement of migration.up) {
          await database.execute(statement);
        }
        
        // Record migration
        await database.execute(
          'INSERT INTO migrations (version) VALUES (?)',
          [migration.version]
        );
        
        console.log(`Migration ${migration.version} applied successfully`);
      } catch (error) {
        console.error(`Failed to apply migration ${migration.version}:`, error);
        throw error;
      }
    }
  }
  
  console.log('All migrations applied successfully');
}

/**
 * Migration definition interface
 */
interface Migration {
  version: string;
  description: string;
  up: string[];
  down: string[];
}

/**
 * Get all migrations in order
 */
function getMigrations(): Migration[] {
  return [
    {
      version: '001',
      description: 'Create initial tables',
      up: [
        `CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT DEFAULT '',
          priority INTEGER DEFAULT 1,
          status TEXT DEFAULT 'pending',
          dependencies TEXT DEFAULT '[]',
          time_estimate INTEGER DEFAULT 0,
          actual_time INTEGER DEFAULT 0,
          due_date DATETIME,
          tags TEXT DEFAULT '[]',
          project_id TEXT,
          parent_task_id TEXT,
          subtasks TEXT DEFAULT '[]',
          completed_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        
        `CREATE TABLE IF NOT EXISTS task_dependencies (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          depends_on_id TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
          FOREIGN KEY (depends_on_id) REFERENCES tasks(id) ON DELETE CASCADE,
          UNIQUE(task_id, depends_on_id)
        )`,
        
        `CREATE TABLE IF NOT EXISTS time_sessions (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          start_time DATETIME NOT NULL,
          end_time DATETIME,
          paused_time INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT 0,
          notes TEXT DEFAULT '',
          breaks TEXT DEFAULT '[]',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        )`,
        
        `CREATE TABLE IF NOT EXISTS focus_sessions (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          planned_duration INTEGER NOT NULL,
          actual_duration INTEGER,
          focus_score REAL,
          distraction_count INTEGER DEFAULT 0,
          distraction_level TEXT DEFAULT 'moderate',
          background_audio TEXT,
          notes TEXT DEFAULT '',
          breaks TEXT DEFAULT '[]',
          metrics TEXT DEFAULT '{}',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          completed_at DATETIME,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        )`,
        
        `CREATE TABLE IF NOT EXISTS productivity_patterns (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL DEFAULT 'default',
          pattern_type TEXT NOT NULL,
          time_slot TEXT NOT NULL,
          productivity_score REAL NOT NULL,
          confidence_level REAL NOT NULL,
          sample_size INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        
        `CREATE TABLE IF NOT EXISTS user_preferences (
          id TEXT PRIMARY KEY DEFAULT 'default',
          working_hours TEXT NOT NULL DEFAULT '{"start":"09:00","end":"17:00"}',
          break_preferences TEXT NOT NULL DEFAULT '{"shortBreakDuration":5,"longBreakDuration":30,"breakInterval":60}',
          focus_preferences TEXT NOT NULL DEFAULT '{"defaultDuration":45,"distractionLevel":"moderate","backgroundAudio":{"type":"silence","volume":0}}',
          notifications TEXT NOT NULL DEFAULT '{"breakReminders":true,"taskDeadlines":true,"dailySummary":false,"weeklyReview":true}',
          theme TEXT DEFAULT 'auto',
          language TEXT DEFAULT 'en',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        
        `CREATE TABLE IF NOT EXISTS ai_suggestions (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          confidence REAL NOT NULL,
          actionable BOOLEAN DEFAULT 1,
          priority INTEGER DEFAULT 1,
          estimated_impact REAL DEFAULT 0,
          reasoning TEXT DEFAULT '',
          actions TEXT DEFAULT '[]',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          dismissed_at DATETIME,
          applied_at DATETIME
        )`
      ],
      down: [
        'DROP TABLE IF EXISTS ai_suggestions',
        'DROP TABLE IF EXISTS user_preferences',
        'DROP TABLE IF EXISTS productivity_patterns',
        'DROP TABLE IF EXISTS focus_sessions',
        'DROP TABLE IF EXISTS time_sessions',
        'DROP TABLE IF EXISTS task_dependencies',
        'DROP TABLE IF EXISTS tasks'
      ]
    },
    
    {
      version: '002',
      description: 'Add indexes for performance',
      up: [
        'CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)',
        'CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority)',
        'CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)',
        'CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at)',
        'CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id)',
        'CREATE INDEX IF NOT EXISTS idx_task_dependencies_task_id ON task_dependencies(task_id)',
        'CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends_on_id ON task_dependencies(depends_on_id)',
        'CREATE INDEX IF NOT EXISTS idx_time_sessions_task_id ON time_sessions(task_id)',
        'CREATE INDEX IF NOT EXISTS idx_time_sessions_start_time ON time_sessions(start_time)',
        'CREATE INDEX IF NOT EXISTS idx_focus_sessions_task_id ON focus_sessions(task_id)',
        'CREATE INDEX IF NOT EXISTS idx_focus_sessions_created_at ON focus_sessions(created_at)',
        'CREATE INDEX IF NOT EXISTS idx_productivity_patterns_user_id ON productivity_patterns(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_productivity_patterns_pattern_type ON productivity_patterns(pattern_type)',
        'CREATE INDEX IF NOT EXISTS idx_ai_suggestions_type ON ai_suggestions(type)',
        'CREATE INDEX IF NOT EXISTS idx_ai_suggestions_created_at ON ai_suggestions(created_at)'
      ],
      down: [
        'DROP INDEX IF EXISTS idx_ai_suggestions_created_at',
        'DROP INDEX IF EXISTS idx_ai_suggestions_type',
        'DROP INDEX IF EXISTS idx_productivity_patterns_pattern_type',
        'DROP INDEX IF EXISTS idx_productivity_patterns_user_id',
        'DROP INDEX IF EXISTS idx_focus_sessions_created_at',
        'DROP INDEX IF EXISTS idx_focus_sessions_task_id',
        'DROP INDEX IF EXISTS idx_time_sessions_start_time',
        'DROP INDEX IF EXISTS idx_time_sessions_task_id',
        'DROP INDEX IF EXISTS idx_task_dependencies_depends_on_id',
        'DROP INDEX IF EXISTS idx_task_dependencies_task_id',
        'DROP INDEX IF EXISTS idx_tasks_parent_task_id',
        'DROP INDEX IF EXISTS idx_tasks_created_at',
        'DROP INDEX IF EXISTS idx_tasks_due_date',
        'DROP INDEX IF EXISTS idx_tasks_priority',
        'DROP INDEX IF EXISTS idx_tasks_status'
      ]
    }
  ];
}

/**
 * Execute a database transaction
 */
export async function executeTransaction<T>(
  callback: (db: Database) => Promise<T>
): Promise<T> {
  const database = await getDatabase();
  
  try {
    await database.execute('BEGIN TRANSACTION');
    const result = await callback(database);
    await database.execute('COMMIT');
    return result;
  } catch (error) {
    await database.execute('ROLLBACK');
    throw error;
  }
}

/**
 * Check database health
 */
export async function checkDatabaseHealth(): Promise<{
  isHealthy: boolean;
  version: string;
  tableCount: number;
  lastMigration?: string;
}> {
  try {
    const database = await getDatabase();
    
    // Check if we can query the database
    const tables = await database.select<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    
    // Get database version
    const versionResult = await database.select<{ sqlite_version: string }[]>(
      'SELECT sqlite_version() as sqlite_version'
    );
    
    // Get last migration
    const lastMigration = await database.select<{ version: string }[]>(
      'SELECT version FROM migrations ORDER BY version DESC LIMIT 1'
    );
    
    return {
      isHealthy: true,
      version: versionResult[0]?.sqlite_version || 'unknown',
      tableCount: tables.length,
      lastMigration: lastMigration[0]?.version
    };
  } catch (error) {
    console.error('Database health check failed:', error);
    return {
      isHealthy: false,
      version: 'unknown',
      tableCount: 0
    };
  }
}