# Requirements Document

## Introduction

This feature enables users to efficiently manage incomplete tasks when transitioning between weeks in KiraPilot. When users navigate to a new week, the system will detect incomplete tasks from the previous week and provide an intuitive interface to migrate them to the current week. This ensures continuity in task management and prevents tasks from being forgotten or lost in previous weeks.

The feature will be implemented for both Week View and Day View, providing a consistent experience across different planning interfaces.

## Requirements

### Requirement 1

**User Story:** As a user navigating to a new week in Week View, I want to be prompted to move incomplete tasks from the previous week, so that I can maintain continuity in my task planning without losing track of unfinished work.

#### Acceptance Criteria

1. WHEN the user navigates to a new week in Week View AND there are incomplete tasks (status: pending or in_progress) from the previous week THEN the system SHALL display a migration prompt dialog
2. WHEN the migration prompt is displayed THEN the system SHALL show a list of all incomplete tasks from the previous week with their titles, priorities, and current scheduled dates
3. WHEN the user selects tasks to migrate THEN the system SHALL provide options to schedule them on specific days of the current week
4. WHEN the user confirms the migration THEN the system SHALL update the scheduledDate of selected tasks to the chosen dates in the current week
5. WHEN the user dismisses the migration prompt THEN the system SHALL remember this choice for the current week transition and not prompt again

### Requirement 2

**User Story:** As a user navigating to a new week in Day View, I want to be prompted to move incomplete tasks from the previous week, so that I can plan my daily schedule with awareness of pending work from previous weeks.

#### Acceptance Criteria

1. WHEN the user navigates to a day in a new week in Day View AND there are incomplete tasks from the previous week THEN the system SHALL display a migration prompt dialog
2. WHEN the migration prompt is displayed in Day View THEN the system SHALL show incomplete tasks with an option to add them to the current day or other days in the week
3. WHEN the user selects tasks to migrate to the current day THEN the system SHALL update their scheduledDate to the current day
4. WHEN the user chooses to schedule tasks for other days THEN the system SHALL provide a day picker for the current week
5. WHEN migration is completed THEN the system SHALL refresh the Day View to show the newly scheduled tasks

### Requirement 3

**User Story:** As a user who frequently works across multiple weeks, I want the migration prompt to be smart about detecting week transitions, so that I'm only prompted when actually moving to a genuinely new week and not when navigating within the same week period.

#### Acceptance Criteria

1. WHEN the user navigates between days within the same week THEN the system SHALL NOT display migration prompts
2. WHEN the user navigates to a week that has already been visited during the current session THEN the system SHALL NOT display migration prompts if previously dismissed
3. WHEN the system detects a week transition THEN it SHALL only consider tasks from the immediately previous week for migration
4. WHEN calculating week boundaries THEN the system SHALL respect the user's weekStartDay preference (Sunday or Monday)
5. WHEN there are no incomplete tasks in the previous week THEN the system SHALL NOT display any migration prompt

### Requirement 4

**User Story:** As a user managing tasks with different priorities and contexts, I want the migration interface to provide clear information about each task, so that I can make informed decisions about which tasks to migrate and when to schedule them.

#### Acceptance Criteria

1. WHEN the migration dialog displays tasks THEN each task SHALL show its title, priority level, original scheduled date, and task list name
2. WHEN tasks have dependencies THEN the system SHALL indicate if dependent tasks are also being migrated or already exist in the current week
3. WHEN the user selects a task for migration THEN the system SHALL provide visual feedback showing the selection state
4. WHEN scheduling migrated tasks THEN the system SHALL suggest appropriate time slots based on the task's time estimate and existing schedule
5. WHEN the migration is complete THEN the system SHALL provide a summary of how many tasks were migrated and to which dates

### Requirement 5

**User Story:** As a user who wants control over my task management workflow, I want options to customize the migration behavior, so that the system adapts to my personal planning preferences.

#### Acceptance Criteria

1. WHEN the migration prompt appears THEN the user SHALL have options to "Migrate Selected", "Skip This Week", and "Don't Ask Again"
2. WHEN the user selects "Don't Ask Again" THEN the system SHALL store this preference and disable automatic migration prompts
3. WHEN migration preferences are disabled THEN the user SHALL still be able to manually trigger migration through a menu option or button
4. WHEN manually triggering migration THEN the system SHALL show tasks from any previous week, not just the immediately previous one
5. WHEN the user has migration preferences set THEN these SHALL be persisted across application restarts

### Requirement 6

**User Story:** As a user working with recurring tasks and templates, I want the migration system to handle periodic task instances appropriately, so that my recurring workflow isn't disrupted by unnecessary migrations.

#### Acceptance Criteria

1. WHEN detecting incomplete tasks for migration THEN the system SHALL exclude periodic task instances that have future instances already generated
2. WHEN a periodic task instance is incomplete but overdue THEN the system SHALL include it in migration options
3. WHEN migrating periodic task instances THEN the system SHALL maintain their connection to the original template
4. WHEN a migrated periodic task is completed THEN it SHALL update the template's generation schedule appropriately
5. WHEN periodic tasks are migrated THEN the system SHALL not interfere with the automatic generation of new instances
