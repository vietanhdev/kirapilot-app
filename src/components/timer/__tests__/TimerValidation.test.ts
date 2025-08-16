import { generateId } from '../../../utils';
import { validateTimerSession } from '../../../types/validation';
import { TimerSession } from '../../../types';

describe('Timer Validation', () => {
  it('should generate valid UUIDs', () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('should validate timer session with proper UUIDs', () => {
    const session: TimerSession = {
      id: generateId(),
      taskId: generateId(),
      startTime: new Date(),
      pausedTime: 0,
      isActive: true,
      notes: 'Test session',
      breaks: [],
      createdAt: new Date()
    };

    const validation = validateTimerSession(session);
    expect(validation.success).toBe(true);
  });

  it('should reject timer session with invalid IDs', () => {
    const session = {
      id: 'invalid-id',
      taskId: 'invalid-task-id',
      startTime: new Date(),
      pausedTime: 0,
      isActive: true,
      notes: 'Test session',
      breaks: [],
      createdAt: new Date()
    };

    const validation = validateTimerSession(session);
    expect(validation.success).toBe(false);
    if (!validation.success) {
      expect(validation.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: 'Invalid session ID' }),
          expect.objectContaining({ message: 'Invalid task ID' })
        ])
      );
    }
  });
});