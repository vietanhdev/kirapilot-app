// Task repository for database operations
import { getDatabase, executeTransaction } from '../index';
import { 
  Task, 
  CreateTaskRequest, 
  UpdateTaskRequest, 
  TaskFilters, 
  TaskSortOptions,
  ValidationResult 
} from '../../../types';
import { 
  createTaskRequestToTask, 
  applyTaskUpdate, 
  taskToDbRow, 
  dbRowToTask,
  hasCircularDependency 
} from '../../../utils/transformations';
import { validateCreateTaskRequest, validateUpdateTaskRequest } from '../../../types/validation';

export class TaskRepository {
  /**
   * Create a new task
   */
  async create(request: CreateTaskRequest): Promise<Task> {
    // Validate input
    const validation = validateCreateTaskRequest(request);
    if (!validation.success) {
      throw new Error(`Invalid task data: ${validation.error.issues.map(i => i.message).join(', ')}`);
    }

    const task = createTaskRequestToTask(validation.data);
    
    return await executeTransaction(async (db) => {
      // Check for circular dependencies
      if (task.dependencies.length > 0) {
        const allTasks = await this.findAll();
        if (hasCircularDependency(task.id, task.dependencies, allTasks)) {
          throw new Error('Circular dependency detected');
        }
      }

      // Insert task
      const dbRow = taskToDbRow(task);
      await db.execute(`
        INSERT INTO tasks (
          id, title, description, priority, status, dependencies,
          time_estimate, actual_time, due_date, tags, project_id,
          parent_task_id, subtasks, completed_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        dbRow.id, dbRow.title, dbRow.description, dbRow.priority, dbRow.status,
        dbRow.dependencies, dbRow.time_estimate, dbRow.actual_time, dbRow.due_date,
        dbRow.tags, dbRow.project_id, dbRow.parent_task_id, dbRow.subtasks,
        dbRow.completed_at, dbRow.created_at, dbRow.updated_at
      ]);

      // Create dependency relationships
      for (const depId of task.dependencies) {
        await db.execute(`
          INSERT INTO task_dependencies (id, task_id, depends_on_id)
          VALUES (?, ?, ?)
        `, [`${task.id}-${depId}`, task.id, depId]);
      }

      // Update parent task's subtasks if this is a subtask
      if (task.parentTaskId) {
        const parent = await this.findById(task.parentTaskId);
        if (parent) {
          const updatedSubtasks = [...parent.subtasks, task.id];
          await db.execute(
            'UPDATE tasks SET subtasks = ?, updated_at = ? WHERE id = ?',
            [JSON.stringify(updatedSubtasks), new Date().toISOString(), parent.id]
          );
        }
      }

      return task;
    });
  }

  /**
   * Find task by ID
   */
  async findById(id: string): Promise<Task | null> {
    const db = await getDatabase();
    
    const result = await db.select<any[]>(
      'SELECT * FROM tasks WHERE id = ?',
      [id]
    );

    return result.length > 0 ? dbRowToTask(result[0]) : null;
  }

  /**
   * Find all tasks with optional filtering and sorting
   */
  async findAll(filters?: TaskFilters, sort?: TaskSortOptions): Promise<Task[]> {
    const db = await getDatabase();
    
    let query = 'SELECT * FROM tasks';
    const params: any[] = [];
    const conditions: string[] = [];

    // Apply filters
    if (filters) {
      if (filters.status && filters.status.length > 0) {
        conditions.push(`status IN (${filters.status.map(() => '?').join(', ')})`);
        params.push(...filters.status);
      }

      if (filters.priority && filters.priority.length > 0) {
        conditions.push(`priority IN (${filters.priority.map(() => '?').join(', ')})`);
        params.push(...filters.priority);
      }

      if (filters.tags && filters.tags.length > 0) {
        // Search for tasks that have any of the specified tags
        const tagConditions = filters.tags.map(() => 'tags LIKE ?').join(' OR ');
        conditions.push(`(${tagConditions})`);
        params.push(...filters.tags.map(tag => `%"${tag}"%`));
      }

      if (filters.dueDate) {
        if (filters.dueDate.from) {
          conditions.push('due_date >= ?');
          params.push(filters.dueDate.from.toISOString());
        }
        if (filters.dueDate.to) {
          conditions.push('due_date <= ?');
          params.push(filters.dueDate.to.toISOString());
        }
      }

      if (filters.projectId) {
        conditions.push('project_id = ?');
        params.push(filters.projectId);
      }

      if (filters.search) {
        conditions.push('(title LIKE ? OR description LIKE ?)');
        params.push(`%${filters.search}%`, `%${filters.search}%`);
      }
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Apply sorting
    if (sort) {
      const direction = sort.direction.toUpperCase();
      switch (sort.field) {
        case 'title':
          query += ` ORDER BY title ${direction}`;
          break;
        case 'priority':
          query += ` ORDER BY priority ${direction}`;
          break;
        case 'dueDate':
          query += ` ORDER BY due_date ${direction}`;
          break;
        case 'createdAt':
          query += ` ORDER BY created_at ${direction}`;
          break;
        case 'updatedAt':
          query += ` ORDER BY updated_at ${direction}`;
          break;
        default:
          query += ` ORDER BY created_at DESC`;
      }
    } else {
      query += ' ORDER BY created_at DESC';
    }

    const result = await db.select<any[]>(query, params);
    return result.map(row => dbRowToTask(row));
  }

  /**
   * Update task
   */
  async update(id: string, request: UpdateTaskRequest): Promise<Task> {
    // Validate input
    const validation = validateUpdateTaskRequest(request);
    if (!validation.success) {
      throw new Error(`Invalid update data: ${validation.error.issues.map(i => i.message).join(', ')}`);
    }

    return await executeTransaction(async (db) => {
      const existingTask = await this.findById(id);
      if (!existingTask) {
        throw new Error(`Task with id ${id} not found`);
      }

      const updatedTask = applyTaskUpdate(existingTask, validation.data);

      // Check for circular dependencies if dependencies changed
      if (request.dependencies) {
        const allTasks = await this.findAll();
        if (hasCircularDependency(id, request.dependencies, allTasks)) {
          throw new Error('Circular dependency detected');
        }
      }

      // Update task
      const dbRow = taskToDbRow(updatedTask);
      await db.execute(`
        UPDATE tasks SET
          title = ?, description = ?, priority = ?, status = ?,
          dependencies = ?, time_estimate = ?, actual_time = ?,
          due_date = ?, tags = ?, completed_at = ?, updated_at = ?
        WHERE id = ?
      `, [
        dbRow.title, dbRow.description, dbRow.priority, dbRow.status,
        dbRow.dependencies, dbRow.time_estimate, dbRow.actual_time,
        dbRow.due_date, dbRow.tags, dbRow.completed_at, dbRow.updated_at, id
      ]);

      // Update dependencies if changed
      if (request.dependencies !== undefined) {
        // Remove existing dependencies
        await db.execute('DELETE FROM task_dependencies WHERE task_id = ?', [id]);
        
        // Add new dependencies
        for (const depId of updatedTask.dependencies) {
          await db.execute(`
            INSERT INTO task_dependencies (id, task_id, depends_on_id)
            VALUES (?, ?, ?)
          `, [`${id}-${depId}`, id, depId]);
        }
      }

      return updatedTask;
    });
  }

  /**
   * Delete task
   */
  async delete(id: string): Promise<void> {
    return await executeTransaction(async (db) => {
      const task = await this.findById(id);
      if (!task) {
        throw new Error(`Task with id ${id} not found`);
      }

      // Remove from parent's subtasks if this is a subtask
      if (task.parentTaskId) {
        const parent = await this.findById(task.parentTaskId);
        if (parent) {
          const updatedSubtasks = parent.subtasks.filter(subId => subId !== id);
          await db.execute(
            'UPDATE tasks SET subtasks = ?, updated_at = ? WHERE id = ?',
            [JSON.stringify(updatedSubtasks), new Date().toISOString(), parent.id]
          );
        }
      }

      // Delete subtasks recursively
      for (const subtaskId of task.subtasks) {
        await this.delete(subtaskId);
      }

      // Dependencies and time sessions will be deleted by CASCADE
      await db.execute('DELETE FROM tasks WHERE id = ?', [id]);
    });
  }

  /**
   * Get task dependencies
   */
  async getDependencies(taskId: string): Promise<Task[]> {
    const db = await getDatabase();
    
    const result = await db.select<any[]>(`
      SELECT t.* FROM tasks t
      INNER JOIN task_dependencies td ON t.id = td.depends_on_id
      WHERE td.task_id = ?
      ORDER BY t.priority DESC, t.created_at ASC
    `, [taskId]);

    return result.map(row => dbRowToTask(row));
  }

  /**
   * Get tasks that depend on this task
   */
  async getDependents(taskId: string): Promise<Task[]> {
    const db = await getDatabase();
    
    const result = await db.select<any[]>(`
      SELECT t.* FROM tasks t
      INNER JOIN task_dependencies td ON t.id = td.task_id
      WHERE td.depends_on_id = ?
      ORDER BY t.priority DESC, t.created_at ASC
    `, [taskId]);

    return result.map(row => dbRowToTask(row));
  }

  /**
   * Get subtasks
   */
  async getSubtasks(parentId: string): Promise<Task[]> {
    const db = await getDatabase();
    
    const result = await db.select<any[]>(
      'SELECT * FROM tasks WHERE parent_task_id = ? ORDER BY created_at ASC',
      [parentId]
    );

    return result.map(row => dbRowToTask(row));
  }

  /**
   * Get tasks by project
   */
  async getByProject(projectId: string): Promise<Task[]> {
    const db = await getDatabase();
    
    const result = await db.select<any[]>(
      'SELECT * FROM tasks WHERE project_id = ? ORDER BY priority DESC, created_at DESC',
      [projectId]
    );

    return result.map(row => dbRowToTask(row));
  }

  /**
   * Get overdue tasks
   */
  async getOverdue(): Promise<Task[]> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    
    const result = await db.select<any[]>(
      'SELECT * FROM tasks WHERE due_date < ? AND status != ? ORDER BY due_date ASC',
      [now, 'completed']
    );

    return result.map(row => dbRowToTask(row));
  }

  /**
   * Get tasks by tag
   */
  async getByTag(tag: string): Promise<Task[]> {
    const db = await getDatabase();
    
    const result = await db.select<any[]>(
      'SELECT * FROM tasks WHERE tags LIKE ? ORDER BY created_at DESC',
      [`%"${tag}"%`]
    );

    return result.map(row => dbRowToTask(row));
  }

  /**
   * Search tasks
   */
  async search(query: string): Promise<Task[]> {
    const db = await getDatabase();
    
    const result = await db.select<any[]>(`
      SELECT * FROM tasks 
      WHERE title LIKE ? OR description LIKE ? OR tags LIKE ?
      ORDER BY 
        CASE 
          WHEN title LIKE ? THEN 1
          WHEN description LIKE ? THEN 2
          ELSE 3
        END,
        priority DESC,
        created_at DESC
    `, [
      `%${query}%`, `%${query}%`, `%${query}%`,
      `%${query}%`, `%${query}%`
    ]);

    return result.map(row => dbRowToTask(row));
  }

  /**
   * Get task statistics
   */
  async getStatistics(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    overdue: number;
    completedToday: number;
    averageCompletionTime: number;
  }> {
    const db = await getDatabase();
    
    // Total tasks
    const totalResult = await db.select<{ count: number }[]>('SELECT COUNT(*) as count FROM tasks');
    const total = totalResult[0]?.count || 0;

    // By status
    const statusResult = await db.select<{ status: string; count: number }[]>(
      'SELECT status, COUNT(*) as count FROM tasks GROUP BY status'
    );
    const byStatus = statusResult.reduce((acc, row) => {
      acc[row.status] = row.count;
      return acc;
    }, {} as Record<string, number>);

    // By priority
    const priorityResult = await db.select<{ priority: number; count: number }[]>(
      'SELECT priority, COUNT(*) as count FROM tasks GROUP BY priority'
    );
    const byPriority = priorityResult.reduce((acc, row) => {
      acc[row.priority.toString()] = row.count;
      return acc;
    }, {} as Record<string, number>);

    // Overdue tasks
    const now = new Date().toISOString();
    const overdueResult = await db.select<{ count: number }[]>(
      'SELECT COUNT(*) as count FROM tasks WHERE due_date < ? AND status != ?',
      [now, 'completed']
    );
    const overdue = overdueResult[0]?.count || 0;

    // Completed today
    const today = new Date().toISOString().split('T')[0];
    const completedTodayResult = await db.select<{ count: number }[]>(
      'SELECT COUNT(*) as count FROM tasks WHERE DATE(completed_at) = ? AND status = ?',
      [today, 'completed']
    );
    const completedToday = completedTodayResult[0]?.count || 0;

    // Average completion time
    const avgTimeResult = await db.select<{ avg_time: number }[]>(
      'SELECT AVG(actual_time) as avg_time FROM tasks WHERE status = ? AND actual_time > 0',
      ['completed']
    );
    const averageCompletionTime = avgTimeResult[0]?.avg_time || 0;

    return {
      total,
      byStatus,
      byPriority,
      overdue,
      completedToday,
      averageCompletionTime
    };
  }

  /**
   * Validate task dependencies
   */
  async validateDependencies(taskId: string): Promise<ValidationResult> {
    const task = await this.findById(taskId);
    if (!task) {
      return {
        isValid: false,
        errors: [`Task with id ${taskId} not found`],
        warnings: []
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if all dependencies exist
    for (const depId of task.dependencies) {
      const dependency = await this.findById(depId);
      if (!dependency) {
        errors.push(`Dependency task ${depId} not found`);
      } else if (dependency.status === 'cancelled') {
        warnings.push(`Dependency task ${depId} is cancelled`);
      }
    }

    // Check for circular dependencies
    const allTasks = await this.findAll();
    if (hasCircularDependency(taskId, task.dependencies, allTasks)) {
      errors.push('Circular dependency detected');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}