import {
  ActionImpact,
  ConfirmationLevel,
  AIActionPreview,
  ActionChange,
  SmartConfirmationOptions,
} from '../../types/aiConfirmation';

export class ConfirmationService {
  private static instance: ConfirmationService;
  private confirmationCallback:
    | ((options: SmartConfirmationOptions) => Promise<boolean>)
    | null = null;

  static getInstance(): ConfirmationService {
    if (!ConfirmationService.instance) {
      ConfirmationService.instance = new ConfirmationService();
    }
    return ConfirmationService.instance;
  }

  setConfirmationCallback(
    callback: (options: SmartConfirmationOptions) => Promise<boolean>
  ) {
    this.confirmationCallback = callback;
  }

  /**
   * Determines the confirmation level based on action impact
   */
  getConfirmationLevel(impact: ActionImpact): ConfirmationLevel {
    switch (impact) {
      case 'low':
        return {
          impact,
          requiresExplicitConfirmation: false,
          showPreview: false,
          allowAlternatives: false,
        };
      case 'medium':
        return {
          impact,
          requiresExplicitConfirmation: true,
          showPreview: true,
          allowAlternatives: true,
        };
      case 'high':
        return {
          impact,
          requiresExplicitConfirmation: true,
          showPreview: true,
          allowAlternatives: true,
        };
      case 'critical':
        return {
          impact,
          requiresExplicitConfirmation: true,
          showPreview: true,
          allowAlternatives: true,
        };
      default:
        return {
          impact: 'medium',
          requiresExplicitConfirmation: true,
          showPreview: true,
          allowAlternatives: true,
        };
    }
  }

  /**
   * Analyzes changes to determine action impact
   */
  analyzeActionImpact(changes: ActionChange[]): ActionImpact {
    let maxImpact: ActionImpact = 'low';

    for (const change of changes) {
      let changeImpact: ActionImpact = 'low';

      switch (change.type) {
        case 'delete':
          changeImpact = 'high';
          break;
        case 'archive':
          changeImpact = 'medium';
          break;
        case 'update':
          // Determine impact based on what's being updated
          if (change.field === 'status' || change.field === 'priority') {
            changeImpact = 'medium';
          } else if (
            change.field === 'title' ||
            change.field === 'description'
          ) {
            changeImpact = 'low';
          } else {
            changeImpact = 'low';
          }
          break;
        case 'create':
          changeImpact = 'low';
          break;
      }

      // Update max impact
      if (this.getImpactLevel(changeImpact) > this.getImpactLevel(maxImpact)) {
        maxImpact = changeImpact;
      }
    }

    // If multiple changes, increase impact
    if (changes.length > 3) {
      maxImpact = this.increaseImpact(maxImpact);
    }

    return maxImpact;
  }

  private getImpactLevel(impact: ActionImpact): number {
    switch (impact) {
      case 'low':
        return 1;
      case 'medium':
        return 2;
      case 'high':
        return 3;
      case 'critical':
        return 4;
      default:
        return 1;
    }
  }

  private increaseImpact(impact: ActionImpact): ActionImpact {
    switch (impact) {
      case 'low':
        return 'medium';
      case 'medium':
        return 'high';
      case 'high':
        return 'critical';
      case 'critical':
        return 'critical';
      default:
        return impact;
    }
  }

  /**
   * Creates an action preview for confirmation
   */
  createActionPreview(
    title: string,
    description: string,
    changes: ActionChange[],
    reversible: boolean = true,
    impact?: ActionImpact
  ): AIActionPreview {
    const finalImpact = impact || this.analyzeActionImpact(changes);

    return {
      title,
      description,
      changes,
      impact: finalImpact,
      reversible,
    };
  }

  /**
   * Requests confirmation for an action
   */
  async requestConfirmation(
    options: SmartConfirmationOptions
  ): Promise<boolean> {
    if (!this.confirmationCallback) {
      console.warn('No confirmation callback set, auto-approving action');
      return true;
    }

    const preview = this.createActionPreview(
      options.title,
      options.description,
      options.changes,
      options.reversible,
      options.impact
    );

    const confirmationLevel = this.getConfirmationLevel(preview.impact);

    // Auto-approve low impact actions
    if (!confirmationLevel.requiresExplicitConfirmation) {
      return true;
    }

    return await this.confirmationCallback(options);
  }

  /**
   * Helper method to create common task-related changes
   */
  createTaskChanges = {
    complete: (taskTitle: string): ActionChange => ({
      type: 'update',
      target: `Task: ${taskTitle}`,
      field: 'status',
      oldValue: 'pending',
      newValue: 'completed',
      description: `Mark task "${taskTitle}" as completed`,
    }),

    delete: (taskTitle: string): ActionChange => ({
      type: 'delete',
      target: `Task: ${taskTitle}`,
      description: `Permanently delete task "${taskTitle}"`,
    }),

    archive: (taskTitle: string): ActionChange => ({
      type: 'archive',
      target: `Task: ${taskTitle}`,
      description: `Archive task "${taskTitle}" (can be restored later)`,
    }),

    updatePriority: (
      taskTitle: string,
      oldPriority: string,
      newPriority: string
    ): ActionChange => ({
      type: 'update',
      target: `Task: ${taskTitle}`,
      field: 'priority',
      oldValue: oldPriority,
      newValue: newPriority,
      description: `Change priority of "${taskTitle}" from ${oldPriority} to ${newPriority}`,
    }),

    updateTitle: (oldTitle: string, newTitle: string): ActionChange => ({
      type: 'update',
      target: `Task: ${oldTitle}`,
      field: 'title',
      oldValue: oldTitle,
      newValue: newTitle,
      description: `Rename task from "${oldTitle}" to "${newTitle}"`,
    }),

    create: (taskTitle: string, priority?: string): ActionChange => ({
      type: 'create',
      target: `Task: ${taskTitle}`,
      field: priority ? 'priority' : undefined,
      newValue: priority,
      description: `Create new task "${taskTitle}"${priority ? ` with ${priority} priority` : ''}`,
    }),
  };
}
