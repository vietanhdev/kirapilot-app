// Database testing component
import { useState } from 'react';
import { useDatabaseContext } from '../../services/database/DatabaseProvider';
import { useDatabaseOperation } from '../../hooks/useDatabase';
import { Database, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

export function DatabaseTest() {
  const { database, isInitialized, health } = useDatabaseContext();
  const { execute, isLoading, error } = useDatabaseOperation();
  const [testResults, setTestResults] = useState<string[]>([]);

  const runDatabaseTests = async () => {
    if (!database || !isInitialized) {
      setTestResults(['Database not initialized']);
      return;
    }

    const results: string[] = [];

    await execute(async () => {
      try {
        // Test 1: Basic query
        const tables = await database.select<{ name: string }[]>(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        );
        results.push(`✅ Found ${tables.length} tables: ${tables.map(t => t.name).join(', ')}`);

        // Test 2: Insert test data
        const testTaskId = `test-${Date.now()}`;
        await database.execute(
          'INSERT INTO tasks (id, title, description, priority, status) VALUES (?, ?, ?, ?, ?)',
          [testTaskId, 'Test Task', 'This is a test task', 1, 'pending']
        );
        results.push('✅ Successfully inserted test task');

        // Test 3: Query test data
        const testTasks = await database.select<any[]>(
          'SELECT * FROM tasks WHERE id = ?',
          [testTaskId]
        );
        results.push(`✅ Successfully queried test task: ${testTasks[0]?.title}`);

        // Test 4: Update test data
        await database.execute(
          'UPDATE tasks SET status = ? WHERE id = ?',
          ['completed', testTaskId]
        );
        results.push('✅ Successfully updated test task');

        // Test 5: Delete test data
        await database.execute(
          'DELETE FROM tasks WHERE id = ?',
          [testTaskId]
        );
        results.push('✅ Successfully deleted test task');

        // Test 6: Check foreign key constraints
        try {
          await database.execute(
            'INSERT INTO task_dependencies (id, task_id, depends_on_id) VALUES (?, ?, ?)',
            ['test-dep', 'nonexistent-task', 'another-nonexistent-task']
          );
          results.push('⚠️ Foreign key constraints may not be enabled');
        } catch (fkError) {
          results.push('✅ Foreign key constraints are working');
        }

        // Test 7: Check indexes
        const indexes = await database.select<{ name: string }[]>(
          "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'"
        );
        results.push(`✅ Found ${indexes.length} custom indexes`);

        setTestResults(results);
      } catch (testError) {
        results.push(`❌ Test failed: ${testError}`);
        setTestResults(results);
        throw testError;
      }
    });
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Database className="w-6 h-6 text-blue-500 mr-2" />
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Database Test Suite
          </h3>
        </div>
        <button
          onClick={runDatabaseTests}
          disabled={!isInitialized || isLoading}
          className="flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 
                     text-white rounded-lg transition-colors duration-200"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Running Tests...' : 'Run Tests'}
        </button>
      </div>

      {/* Health Status */}
      {health && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-300">Database Health:</span>
            <div className="flex items-center">
              {health.isHealthy ? (
                <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-500 mr-1" />
              )}
              <span className={health.isHealthy ? 'text-green-600' : 'text-red-600'}>
                {health.isHealthy ? 'Healthy' : 'Unhealthy'}
              </span>
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            SQLite {health.version} • {health.tableCount} tables
            {health.lastMigration && ` • Migration ${health.lastMigration}`}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="w-4 h-4 text-red-500 mr-2" />
            <span className="text-red-800 text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Test Results */}
      {testResults.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-slate-800 dark:text-slate-100">Test Results:</h4>
          <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-3 max-h-64 overflow-y-auto">
            {testResults.map((result, index) => (
              <div key={index} className="text-sm font-mono text-slate-700 dark:text-slate-300 mb-1">
                {result}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      {testResults.length === 0 && (
        <div className="text-center text-slate-500 dark:text-slate-400 py-8">
          <Database className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Click "Run Tests" to verify database functionality</p>
        </div>
      )}
    </div>
  );
}