// Mock database implementation for testing
export class MockDatabase {
  private data: Map<string, any[]> = new Map();
  private isConnected = false;

  async load(_connectionString: string): Promise<MockDatabase> {
    this.isConnected = true;
    return this;
  }

  async close(): Promise<void> {
    this.isConnected = false;
    this.data.clear();
  }

  async execute(query: string, params: any[] = []): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    // Simple mock implementation for common SQL operations
    const normalizedQuery = query.trim().toLowerCase();

    if (normalizedQuery.startsWith('create table')) {
      // Extract table name and create empty array
      const match = query.match(/create table (?:if not exists )?(\w+)/i);
      if (match) {
        const tableName = match[1];
        if (!this.data.has(tableName)) {
          this.data.set(tableName, []);
        }
      }
    } else if (normalizedQuery.startsWith('insert into')) {
      // Extract table name and insert data
      const match = query.match(/insert into (\w+)/i);
      if (match) {
        const tableName = match[1];
        const table = this.data.get(tableName) || [];

        // Create a mock row with the parameters
        const row: any = {};
        const columns = this.extractColumnsFromInsert(query);
        columns.forEach((col, index) => {
          row[col] = params[index];
        });

        table.push(row);
        this.data.set(tableName, table);
      }
    } else if (normalizedQuery.startsWith('update')) {
      // Extract table name and update data
      const match = query.match(/update (\w+)/i);
      if (match) {
        const tableName = match[1];
        const table = this.data.get(tableName) || [];

        // Simple update - find by first parameter (usually ID)
        const whereValue = params[params.length - 1];
        const rowIndex = table.findIndex(row =>
          Object.values(row).includes(whereValue)
        );

        if (rowIndex >= 0) {
          const columns = this.extractColumnsFromUpdate(query);
          columns.forEach((col, index) => {
            if (index < params.length - 1) {
              table[rowIndex][col] = params[index];
            }
          });
        }
      }
    } else if (normalizedQuery.startsWith('delete from')) {
      // Extract table name and delete data
      const match = query.match(/delete from (\w+)/i);
      if (match) {
        const tableName = match[1];
        const table = this.data.get(tableName) || [];

        if (params.length > 0) {
          // Delete by parameter (usually ID)
          const whereValue = params[0];
          const filteredTable = table.filter(
            row => !Object.values(row).includes(whereValue)
          );
          this.data.set(tableName, filteredTable);
        } else {
          // Delete all
          this.data.set(tableName, []);
        }
      }
    }
  }

  async select<T = any[]>(query: string, params: any[] = []): Promise<T> {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    const normalizedQuery = query.trim().toLowerCase();

    if (normalizedQuery.includes('from')) {
      // Extract table name
      const match = query.match(/from (\w+)/i);
      if (match) {
        const tableName = match[1];
        let table = this.data.get(tableName) || [];

        // Simple WHERE clause handling
        if (normalizedQuery.includes('where') && params.length > 0) {
          const whereValue = params[0];
          table = table.filter(row => Object.values(row).includes(whereValue));
        }

        // Simple COUNT handling
        if (normalizedQuery.includes('count(*)')) {
          return [{ count: table.length }] as T;
        }

        // Simple LIMIT handling
        const limitMatch = query.match(/limit (\d+)/i);
        if (limitMatch) {
          const limit = parseInt(limitMatch[1]);
          table = table.slice(0, limit);
        }

        return table as T;
      }
    }

    // Handle special queries
    if (normalizedQuery.includes('sqlite_master')) {
      // Return mock table list
      const tables = Array.from(this.data.keys()).map(name => ({ name }));
      return tables as T;
    }

    if (normalizedQuery.includes('sqlite_version')) {
      return [{ sqlite_version: '3.0.0-mock' }] as T;
    }

    return [] as T;
  }

  private extractColumnsFromInsert(query: string): string[] {
    const match = query.match(/\(([^)]+)\)/);
    if (match) {
      return match[1].split(',').map(col => col.trim());
    }
    return [];
  }

  private extractColumnsFromUpdate(query: string): string[] {
    const match = query.match(/set\s+(.+?)\s+where/i);
    if (match) {
      return match[1].split(',').map(col => col.split('=')[0].trim());
    }
    return [];
  }
}

// Mock the Database import
export default {
  load: async (connectionString: string) => {
    const db = new MockDatabase();
    return await db.load(connectionString);
  },
};
