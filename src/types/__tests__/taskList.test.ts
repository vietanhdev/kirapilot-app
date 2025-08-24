import {
  TaskList,
  TaskListSelection,
  CreateTaskListRequest,
  UpdateTaskListRequest,
  TaskListService,
  TASK_LIST_ALL,
  TASK_LIST_DEFAULT,
} from '../index';

describe('TaskList Types', () => {
  describe('TaskList interface', () => {
    it('should have correct structure', () => {
      const taskList: TaskList = {
        id: 'test-id',
        name: 'Test List',
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(taskList.id).toBe('test-id');
      expect(taskList.name).toBe('Test List');
      expect(taskList.isDefault).toBe(false);
      expect(taskList.createdAt).toBeInstanceOf(Date);
      expect(taskList.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('TaskListSelection interface', () => {
    it('should support "all" type selection', () => {
      const selection: TaskListSelection = {
        type: 'all',
      };

      expect(selection.type).toBe('all');
      expect(selection.taskListId).toBeUndefined();
      expect(selection.taskList).toBeUndefined();
    });

    it('should support "specific" type selection', () => {
      const taskList: TaskList = {
        id: 'test-id',
        name: 'Test List',
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const selection: TaskListSelection = {
        type: 'specific',
        taskListId: 'test-id',
        taskList,
      };

      expect(selection.type).toBe('specific');
      expect(selection.taskListId).toBe('test-id');
      expect(selection.taskList).toBe(taskList);
    });
  });

  describe('Request interfaces', () => {
    it('should have correct CreateTaskListRequest structure', () => {
      const request: CreateTaskListRequest = {
        name: 'New Task List',
      };

      expect(request.name).toBe('New Task List');
    });

    it('should have correct UpdateTaskListRequest structure', () => {
      const request: UpdateTaskListRequest = {
        name: 'Updated Task List',
      };

      expect(request.name).toBe('Updated Task List');
    });
  });

  describe('Special constants', () => {
    it('should have correct special identifiers', () => {
      expect(TASK_LIST_ALL).toBe('__ALL__');
      expect(TASK_LIST_DEFAULT).toBe('__DEFAULT__');
    });
  });

  describe('TaskListService interface', () => {
    it('should define all required methods', () => {
      // This is a compile-time test - if the interface is correct, this will compile
      const mockService: TaskListService = {
        getAllTaskLists: jest.fn(),
        createTaskList: jest.fn(),
        updateTaskList: jest.fn(),
        deleteTaskList: jest.fn(),
        getDefaultTaskList: jest.fn(),
        moveTaskToList: jest.fn(),
      };

      expect(mockService.getAllTaskLists).toBeDefined();
      expect(mockService.createTaskList).toBeDefined();
      expect(mockService.updateTaskList).toBeDefined();
      expect(mockService.deleteTaskList).toBeDefined();
      expect(mockService.getDefaultTaskList).toBeDefined();
      expect(mockService.moveTaskToList).toBeDefined();
    });
  });
});
