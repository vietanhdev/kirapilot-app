// Tests for TaskRepository
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { TaskRepository } from '../TaskRepository';
import { Priority, TaskStatus } from '../../../../types';
import { initializeDatabase, closeDatabase } from '../../index';

describe('TaskRepository', () => {
  let repository: TaskRepository;

  beforeEach(async () => {
    // Initialize in-memory database for testing
    await initializeDatabase();
    repository = new TaskRepository();
  });

  afterEach(async () => {
    await closeDatabase();
  });

  describe('create', () => {
    test('should create a new task', async () => {
      const taskRequest = {
        title: 'Test Task',
        description: 'A test task description',
        priority: Priority.HIGH,
        timeEstimate: 60,
        tags: ['test', 'unit']
      };

      const task = await repository.create(taskRequest);

      expect(task.id).toBeDefined();
      expect(task.title).toBe(taskRequest.title);
      expect(task.description).toBe(taskRequest.description);
      expect(task.priority).toBe(taskRequest.priority);
      expect(task.status).toBe(TaskStatus.PENDING);
      expect(task.timeEstimate).toBe(taskRequest.timeEstimate);
      expect(task.tags).toEqual(taskRequest.tags);
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);
    });

    test('should reject invalid task data', async () => {
      const invalidRequest = {
        title: '', // Empty title should be rejected
        description: 'A test task description'
      };

      await expect(repository.create(invalidRequest)).rejects.toThrow('Invalid task data');
    });

    test('should handle task with dependencies', async () => {
      // Create dependency task first
      const depTask = await repository.create({
        title: 'Dependency Task',
        description: 'A dependency task'
      });

      const taskRequest = {
        title: 'Main Task',
        description: 'A task with dependencies',
        dependencies: [depTask.id]
      };

      const task = await repository.create(taskRequest);

      expect(task.dependencies).toContain(depTask.id);
      
      // Verify dependency relationship was created
      const dependencies = await repository.getDependencies(task.id);
      expect(dependencies).toHaveLength(1);
      expect(dependencies[0].id).toBe(depTask.id);
    });

    test('should reject circular dependencies', async () => {
      const task1 = await repository.create({
        title: 'Task 1',
        description: 'First task'
      });

      const task2 = await repository.create({
        title: 'Task 2',
        description: 'Second task',
        dependencies: [task1.id]
      });

      // Try to create circular dependency
      await expect(repository.update(task1.id, {
        dependencies: [task2.id]
      })).rejects.toThrow('Circular dependency detected');
    });
  });

  describe('findById', () => {
    test('should find existing task', async () => {
      const createdTask = await repository.create({
        title: 'Test Task',
        description: 'A test task'
      });

      const foundTask = await repository.findById(createdTask.id);

      expect(foundTask).not.toBeNull();
      expect(foundTask!.id).toBe(createdTask.id);
      expect(foundTask!.title).toBe(createdTask.title);
    });

    test('should return null for non-existent task', async () => {
      const foundTask = await repository.findById('non-existent-id');
      expect(foundTask).toBeNull();
    });
  });

  describe('findAll', () => {
    beforeEach(async () => {
      // Create test tasks
      await repository.create({
        title: 'High Priority Task',
        priority: Priority.HIGH,
        tags: ['urgent']
      });

      const task2 = await repository.create({
        title: 'Low Priority Task',
        priority: Priority.LOW,
        tags: ['routine']
      });

      const task3 = await repository.create({
        title: 'Medium Priority Task',
        priority: Priority.MEDIUM,
        tags: ['work']
      });

      // Update statuses after creation
      await repository.update(task2.id, { status: TaskStatus.COMPLETED });
      await repository.update(task3.id, { status: TaskStatus.IN_PROGRESS });
    });

    test('should return all tasks without filters', async () => {
      const tasks = await repository.findAll();
      expect(tasks).toHaveLength(3);
    });

    test('should filter by status', async () => {
      const pendingTasks = await repository.findAll({
        status: [TaskStatus.PENDING]
      });

      expect(pendingTasks).toHaveLength(1);
      expect(pendingTasks[0].status).toBe(TaskStatus.PENDING);
    });

    test('should filter by priority', async () => {
      const highPriorityTasks = await repository.findAll({
        priority: [Priority.HIGH]
      });

      expect(highPriorityTasks).toHaveLength(1);
      expect(highPriorityTasks[0].priority).toBe(Priority.HIGH);
    });

    test('should filter by tags', async () => {
      const urgentTasks = await repository.findAll({
        tags: ['urgent']
      });

      expect(urgentTasks).toHaveLength(1);
      expect(urgentTasks[0].tags).toContain('urgent');
    });

    test('should search by title and description', async () => {
      const searchResults = await repository.findAll({
        search: 'High Priority'
      });

      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].title).toContain('High Priority');
    });

    test('should sort tasks', async () => {
      const tasksByPriority = await repository.findAll(undefined, {
        field: 'priority',
        direction: 'desc'
      });

      expect(tasksByPriority[0].priority).toBe(Priority.HIGH);
      expect(tasksByPriority[2].priority).toBe(Priority.LOW);
    });
  });

  describe('update', () => {
    test('should update task properties', async () => {
      const task = await repository.create({
        title: 'Original Title',
        description: 'Original description',
        priority: Priority.LOW
      });

      const updatedTask = await repository.update(task.id, {
        title: 'Updated Title',
        priority: Priority.HIGH,
        status: TaskStatus.IN_PROGRESS
      });

      expect(updatedTask.title).toBe('Updated Title');
      expect(updatedTask.priority).toBe(Priority.HIGH);
      expect(updatedTask.status).toBe(TaskStatus.IN_PROGRESS);
      expect(updatedTask.updatedAt.getTime()).toBeGreaterThan(task.updatedAt.getTime());
    });

    test('should set completion time when task is completed', async () => {
      const task = await repository.create({
        title: 'Test Task',
        description: 'A test task'
      });

      const updatedTask = await repository.update(task.id, {
        status: TaskStatus.COMPLETED
      });

      expect(updatedTask.completedAt).toBeInstanceOf(Date);
    });

    test('should reject invalid update data', async () => {
      const task = await repository.create({
        title: 'Test Task',
        description: 'A test task'
      });

      await expect(repository.update(task.id, {
        title: '' // Empty title should be rejected
      })).rejects.toThrow('Invalid update data');
    });

    test('should throw error for non-existent task', async () => {
      await expect(repository.update('non-existent-id', {
        title: 'Updated Title'
      })).rejects.toThrow('Task with id non-existent-id not found');
    });
  });

  describe('delete', () => {
    test('should delete task', async () => {
      const task = await repository.create({
        title: 'Task to Delete',
        description: 'This task will be deleted'
      });

      await repository.delete(task.id);

      const deletedTask = await repository.findById(task.id);
      expect(deletedTask).toBeNull();
    });

    test('should delete subtasks recursively', async () => {
      const parentTask = await repository.create({
        title: 'Parent Task',
        description: 'A parent task'
      });

      const subtask = await repository.create({
        title: 'Subtask',
        description: 'A subtask',
        parentTaskId: parentTask.id
      });

      await repository.delete(parentTask.id);

      const deletedParent = await repository.findById(parentTask.id);
      const deletedSubtask = await repository.findById(subtask.id);
      
      expect(deletedParent).toBeNull();
      expect(deletedSubtask).toBeNull();
    });

    test('should throw error for non-existent task', async () => {
      await expect(repository.delete('non-existent-id')).rejects.toThrow('Task with id non-existent-id not found');
    });
  });

  describe('getDependencies', () => {
    test('should return task dependencies', async () => {
      const dep1 = await repository.create({
        title: 'Dependency 1',
        description: 'First dependency'
      });

      const dep2 = await repository.create({
        title: 'Dependency 2',
        description: 'Second dependency'
      });

      const mainTask = await repository.create({
        title: 'Main Task',
        description: 'Task with dependencies',
        dependencies: [dep1.id, dep2.id]
      });

      const dependencies = await repository.getDependencies(mainTask.id);

      expect(dependencies).toHaveLength(2);
      expect(dependencies.map(d => d.id)).toContain(dep1.id);
      expect(dependencies.map(d => d.id)).toContain(dep2.id);
    });
  });

  describe('getStatistics', () => {
    beforeEach(async () => {
      // Create test data
      const task1 = await repository.create({
        title: 'Completed Task 1',
        priority: Priority.HIGH
      });

      const task2 = await repository.create({
        title: 'Completed Task 2',
        priority: Priority.MEDIUM
      });

      await repository.create({
        title: 'Pending Task',
        priority: Priority.LOW
      });

      // Update to completed status (actualTime is managed internally)
      await repository.update(task1.id, { 
        status: TaskStatus.COMPLETED
      });
      
      await repository.update(task2.id, { 
        status: TaskStatus.COMPLETED
      });
    });

    test('should return task statistics', async () => {
      const stats = await repository.getStatistics();

      expect(stats.total).toBe(3);
      expect(stats.byStatus['completed']).toBe(2);
      expect(stats.byStatus['pending']).toBe(1);
      expect(stats.byPriority['2']).toBe(1); // HIGH priority
      expect(stats.byPriority['1']).toBe(1); // MEDIUM priority
      expect(stats.byPriority['0']).toBe(1); // LOW priority
      expect(stats.averageCompletionTime).toBe(0); // No actual time recorded in this test
    });
  });

  describe('validateDependencies', () => {
    test('should validate valid dependencies', async () => {
      const dep = await repository.create({
        title: 'Dependency Task',
        description: 'A dependency'
      });

      const task = await repository.create({
        title: 'Main Task',
        dependencies: [dep.id]
      });

      const validation = await repository.validateDependencies(task.id);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should detect missing dependencies', async () => {
      const task = await repository.create({
        title: 'Main Task',
        dependencies: ['non-existent-id']
      });

      const validation = await repository.validateDependencies(task.id);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Dependency task non-existent-id not found');
    });
  });
});