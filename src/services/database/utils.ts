// Database utility functions
import { getDatabase } from './index';

/**
 * Reset the database by dropping all tables and re-running migrations
 */
export async function resetDatabase(): Promise<void> {
  const db = await getDatabase();
  
  console.log('Resetting database...');
  
  // Drop all tables in reverse dependency order
  const dropTables = [
    'ai_suggestions',
    'user_preferences', 
    'productivity_patterns',
    'focus_sessions',
    'time_sessions',
    'task_dependencies',
    'tasks',
    'migrations'
  ];
  
  for (const table of dropTables) {
    try {
      await db.execute(`DROP TABLE IF EXISTS ${table}`);
      console.log(`Dropped table: ${table}`);
    } catch (error) {
      console.warn(`Failed to drop table ${table}:`, error);
    }
  }
  
  // Reset the database connection to force reinitialization
  try {
    const { resetDatabaseConnection, initializeDatabase } = await import('./index');
    await resetDatabaseConnection();
    await initializeDatabase();
    console.log('Database reinitialized with fresh schema');
  } catch (error) {
    console.warn('Failed to reinitialize database:', error);
  }
  
  console.log('Database reset complete.');
}

/**
 * Get database statistics
 */
export async function getDatabaseStats(): Promise<{
  tables: Array<{ name: string; count: number }>;
  totalRecords: number;
  databaseSize: string;
}> {
  const db = await getDatabase();
  
  // Get all user tables
  const tables = await db.select<{ name: string }[]>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'migrations'"
  );
  
  const tableStats = [];
  let totalRecords = 0;
  
  for (const table of tables) {
    try {
      const countResult = await db.select<{ count: number }[]>(
        `SELECT COUNT(*) as count FROM ${table.name}`
      );
      const count = countResult[0]?.count || 0;
      tableStats.push({ name: table.name, count });
      totalRecords += count;
    } catch (error) {
      console.warn(`Failed to count records in ${table.name}:`, error);
      tableStats.push({ name: table.name, count: 0 });
    }
  }
  
  // Get database size (approximate)
  const sizeResult = await db.select<{ page_count: number; page_size: number }[]>(
    'PRAGMA page_count, page_size'
  );
  
  const pageCount = sizeResult[0]?.page_count || 0;
  const pageSize = sizeResult[1]?.page_size || 4096;
  const sizeBytes = pageCount * pageSize;
  const sizeKB = Math.round(sizeBytes / 1024);
  const databaseSize = sizeKB > 1024 ? `${Math.round(sizeKB / 1024)} MB` : `${sizeKB} KB`;
  
  return {
    tables: tableStats,
    totalRecords,
    databaseSize
  };
}

/**
 * Backup database to JSON
 */
export async function exportDatabaseToJSON(): Promise<string> {
  const db = await getDatabase();
  
  const backup: Record<string, any[]> = {};
  
  // Get all user tables
  const tables = await db.select<{ name: string }[]>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'migrations'"
  );
  
  for (const table of tables) {
    try {
      const data = await db.select<any[]>(`SELECT * FROM ${table.name}`);
      backup[table.name] = data;
    } catch (error) {
      console.warn(`Failed to export table ${table.name}:`, error);
      backup[table.name] = [];
    }
  }
  
  return JSON.stringify(backup, null, 2);
}

/**
 * Vacuum the database to reclaim space
 */
export async function vacuumDatabase(): Promise<void> {
  const db = await getDatabase();
  
  console.log('Vacuuming database...');
  await db.execute('VACUUM');
  console.log('Database vacuum complete');
}

/**
 * Analyze database for query optimization
 */
export async function analyzeDatabase(): Promise<void> {
  const db = await getDatabase();
  
  console.log('Analyzing database...');
  await db.execute('ANALYZE');
  console.log('Database analysis complete');
}

/**
 * Check database integrity
 */
export async function checkDatabaseIntegrity(): Promise<{
  isValid: boolean;
  errors: string[];
}> {
  const db = await getDatabase();
  
  try {
    const result = await db.select<{ integrity_check: string }[]>('PRAGMA integrity_check');
    
    const errors = result
      .map(row => row.integrity_check)
      .filter(check => check !== 'ok');
    
    return {
      isValid: errors.length === 0,
      errors
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [`Integrity check failed: ${error}`]
    };
  }
}

/**
 * Get foreign key violations
 */
export async function checkForeignKeys(): Promise<Array<{
  table: string;
  rowid: number;
  parent: string;
  fkid: number;
}>> {
  const db = await getDatabase();
  
  try {
    return await db.select('PRAGMA foreign_key_check');
  } catch (error) {
    console.warn('Foreign key check failed:', error);
    return [];
  }
}