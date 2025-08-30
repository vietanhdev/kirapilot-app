import { ConfirmationService } from '../ConfirmationService';
import { ActionChange } from '../../../types/aiConfirmation';

describe('ConfirmationService', () => {
  let confirmationService: ConfirmationService;

  beforeEach(() => {
    confirmationService = ConfirmationService.getInstance();
  });

  describe('analyzeActionImpact', () => {
    it('should return low impact for create actions', () => {
      const changes: ActionChange[] = [
        {
          type: 'create',
          target: 'Task: New Task',
          description: 'Create new task',
        },
      ];

      const impact = confirmationService.analyzeActionImpact(changes);
      expect(impact).toBe('low');
    });

    it('should return medium impact for update actions', () => {
      const changes: ActionChange[] = [
        {
          type: 'update',
          target: 'Task: Existing Task',
          field: 'status',
          oldValue: 'pending',
          newValue: 'completed',
          description: 'Mark task as completed',
        },
      ];

      const impact = confirmationService.analyzeActionImpact(changes);
      expect(impact).toBe('medium');
    });

    it('should return high impact for delete actions', () => {
      const changes: ActionChange[] = [
        {
          type: 'delete',
          target: 'Task: Important Task',
          description: 'Delete task permanently',
        },
      ];

      const impact = confirmationService.analyzeActionImpact(changes);
      expect(impact).toBe('high');
    });

    it('should return higher impact for multiple changes', () => {
      const changes: ActionChange[] = [
        {
          type: 'update',
          target: 'Task: Task 1',
          description: 'Update task 1',
        },
        {
          type: 'update',
          target: 'Task: Task 2',
          description: 'Update task 2',
        },
        {
          type: 'update',
          target: 'Task: Task 3',
          description: 'Update task 3',
        },
        {
          type: 'update',
          target: 'Task: Task 4',
          description: 'Update task 4',
        },
      ];

      const impact = confirmationService.analyzeActionImpact(changes);
      expect(impact).toBe('medium'); // Should be increased from low due to multiple changes
    });
  });

  describe('getConfirmationLevel', () => {
    it('should not require confirmation for low impact actions', () => {
      const level = confirmationService.getConfirmationLevel('low');
      expect(level.requiresExplicitConfirmation).toBe(false);
      expect(level.showPreview).toBe(false);
      expect(level.allowAlternatives).toBe(false);
    });

    it('should require confirmation for medium impact actions', () => {
      const level = confirmationService.getConfirmationLevel('medium');
      expect(level.requiresExplicitConfirmation).toBe(true);
      expect(level.showPreview).toBe(true);
      expect(level.allowAlternatives).toBe(true);
    });

    it('should require confirmation for high impact actions', () => {
      const level = confirmationService.getConfirmationLevel('high');
      expect(level.requiresExplicitConfirmation).toBe(true);
      expect(level.showPreview).toBe(true);
      expect(level.allowAlternatives).toBe(true);
    });

    it('should require confirmation for critical impact actions', () => {
      const level = confirmationService.getConfirmationLevel('critical');
      expect(level.requiresExplicitConfirmation).toBe(true);
      expect(level.showPreview).toBe(true);
      expect(level.allowAlternatives).toBe(true);
    });
  });

  describe('createActionPreview', () => {
    it('should create a proper action preview', () => {
      const changes: ActionChange[] = [
        {
          type: 'delete',
          target: 'Task: Test Task',
          description: 'Delete test task',
        },
      ];

      const preview = confirmationService.createActionPreview(
        'Delete Task',
        'This will permanently delete the task',
        changes,
        false
      );

      expect(preview.title).toBe('Delete Task');
      expect(preview.description).toBe('This will permanently delete the task');
      expect(preview.changes).toEqual(changes);
      expect(preview.impact).toBe('high');
      expect(preview.reversible).toBe(false);
    });
  });

  describe('createTaskChanges helpers', () => {
    it('should create complete task change', () => {
      const change =
        confirmationService.createTaskChanges.complete('Test Task');

      expect(change.type).toBe('update');
      expect(change.target).toBe('Task: Test Task');
      expect(change.field).toBe('status');
      expect(change.oldValue).toBe('pending');
      expect(change.newValue).toBe('completed');
      expect(change.description).toContain('Test Task');
    });

    it('should create delete task change', () => {
      const change = confirmationService.createTaskChanges.delete('Test Task');

      expect(change.type).toBe('delete');
      expect(change.target).toBe('Task: Test Task');
      expect(change.description).toContain('delete');
      expect(change.description).toContain('Test Task');
    });

    it('should create archive task change', () => {
      const change = confirmationService.createTaskChanges.archive('Test Task');

      expect(change.type).toBe('archive');
      expect(change.target).toBe('Task: Test Task');
      expect(change.description).toContain('Archive');
      expect(change.description).toContain('Test Task');
    });

    it('should create priority update change', () => {
      const change = confirmationService.createTaskChanges.updatePriority(
        'Test Task',
        'low',
        'high'
      );

      expect(change.type).toBe('update');
      expect(change.field).toBe('priority');
      expect(change.oldValue).toBe('low');
      expect(change.newValue).toBe('high');
    });

    it('should create title update change', () => {
      const change = confirmationService.createTaskChanges.updateTitle(
        'Old Title',
        'New Title'
      );

      expect(change.type).toBe('update');
      expect(change.field).toBe('title');
      expect(change.oldValue).toBe('Old Title');
      expect(change.newValue).toBe('New Title');
    });

    it('should create task creation change', () => {
      const change = confirmationService.createTaskChanges.create(
        'New Task',
        'high'
      );

      expect(change.type).toBe('create');
      expect(change.target).toBe('Task: New Task');
      expect(change.field).toBe('priority');
      expect(change.newValue).toBe('high');
    });
  });

  describe('requestConfirmation', () => {
    it('should auto-approve low impact actions when no callback is set', async () => {
      const options = {
        title: 'Test Action',
        description: 'Test description',
        changes: [
          {
            type: 'create' as const,
            target: 'Task: Test',
            description: 'Create test task',
          },
        ],
        onConfirm: jest.fn(),
      };

      const result = await confirmationService.requestConfirmation(options);
      expect(result).toBe(true);
    });

    it('should call confirmation callback for high impact actions', async () => {
      const mockCallback = jest.fn().mockResolvedValue(true);
      confirmationService.setConfirmationCallback(mockCallback);

      const options = {
        title: 'Delete Task',
        description: 'This will delete the task',
        changes: [
          {
            type: 'delete' as const,
            target: 'Task: Test',
            description: 'Delete test task',
          },
        ],
        onConfirm: jest.fn(),
      };

      const result = await confirmationService.requestConfirmation(options);
      expect(result).toBe(true);
      expect(mockCallback).toHaveBeenCalledWith(options);
    });
  });
});
