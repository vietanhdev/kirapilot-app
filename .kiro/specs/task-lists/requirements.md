# Requirements Document

## Introduction

This feature adds task list functionality to KiraPilot, allowing users to organize their tasks into separate lists or projects. Users can create multiple task lists, switch between them using a dropdown in the header, and filter both the week planner and day planner views based on the selected task list. A default task list will be available for users who don't specify a particular list.

## Requirements

### Requirement 1

**User Story:** As a user, I want to create multiple task lists so that I can organize my tasks by project or category.

#### Acceptance Criteria

1. WHEN the user accesses the task list dropdown THEN the system SHALL display an option to create a new task list
2. WHEN the user creates a new task list THEN the system SHALL prompt for a task list name
3. WHEN the user provides a valid task list name THEN the system SHALL create the task list and make it the active selection
4. WHEN the user creates a task list without providing a name THEN the system SHALL use a default naming pattern like "Task List 1", "Task List 2", etc.

### Requirement 2

**User Story:** As a user, I want to switch between different task lists so that I can focus on tasks from a specific project or category.

#### Acceptance Criteria

1. WHEN the user clicks the task list dropdown in the header THEN the system SHALL display all available task lists plus an "All" option
2. WHEN the user selects a specific task list THEN the system SHALL update the active task list and filter views to show only tasks from that list
3. WHEN the user selects "All" THEN the system SHALL show tasks from all task lists in both planners
4. WHEN the active task list changes THEN the system SHALL filter the week planner to show only tasks from the selected list (or all tasks if "All" is selected)
5. WHEN the active task list changes THEN the system SHALL filter the day planner to show only tasks from the selected list (or all tasks if "All" is selected)
6. WHEN no task list is explicitly selected THEN the system SHALL use the "Default" task list

### Requirement 3

**User Story:** As a user, I want to edit task list names so that I can keep my organization system up to date.

#### Acceptance Criteria

1. WHEN the user accesses the task list dropdown THEN the system SHALL provide an option to edit the current task list name
2. WHEN the user chooses to edit a task list name THEN the system SHALL display an input field with the current name
3. WHEN the user saves a valid new name THEN the system SHALL update the task list name
4. WHEN the user tries to save an empty name THEN the system SHALL prevent the update and show an error message

### Requirement 4

**User Story:** As a user, I want to delete task lists I no longer need so that I can keep my workspace clean.

#### Acceptance Criteria

1. WHEN the user accesses the task list dropdown THEN the system SHALL provide an option to delete the current task list
2. WHEN the user chooses to delete a task list THEN the system SHALL show a confirmation dialog warning about data loss
3. WHEN the user confirms deletion AND the task list contains tasks THEN the system SHALL move all tasks to the Default task list
4. WHEN the user confirms deletion AND the task list is empty THEN the system SHALL delete the task list immediately
5. WHEN the user deletes the currently active task list THEN the system SHALL switch to the Default task list
6. WHEN the user tries to delete the Default task list THEN the system SHALL prevent deletion and show an error message

### Requirement 5

**User Story:** As a user, I want all my tasks to be associated with a task list so that my organization system is consistent.

#### Acceptance Criteria

1. WHEN a user creates a new task AND a specific task list is selected THEN the system SHALL associate it with the currently active task list
2. WHEN a user creates a task AND "All" is selected THEN the system SHALL associate it with the Default task list
3. WHEN a user creates a task and no task list is selected THEN the system SHALL associate it with the Default task list
4. WHEN the system starts for the first time THEN the system SHALL create a Default task list automatically
5. WHEN a user has existing tasks without a task list association THEN the system SHALL migrate them to the Default task list

### Requirement 6

**User Story:** As a user, I want the task list selection to persist across app sessions so that I don't lose my context when restarting the app.

#### Acceptance Criteria

1. WHEN the user selects a task list THEN the system SHALL remember this selection in user preferences
2. WHEN the user restarts the application THEN the system SHALL restore the previously selected task list
3. WHEN the previously selected task list no longer exists THEN the system SHALL default to the Default task list
4. WHEN no previous selection exists THEN the system SHALL default to the Default task list

### Requirement 7

**User Story:** As a user, I want to move tasks between task lists so that I can reorganize my work as projects evolve.

#### Acceptance Criteria

1. WHEN the user edits a task THEN the system SHALL provide an option to change the task's task list
2. WHEN the user selects a different task list for a task THEN the system SHALL move the task to the selected list
3. WHEN the user moves a task to a different list THEN the system SHALL update the task's task_list_id
4. WHEN the user moves a task and the destination list is not currently active THEN the task SHALL disappear from the current view

### Requirement 8

**User Story:** As a user, I want the "All" option to behave appropriately for task list management operations.

#### Acceptance Criteria

1. WHEN "All" is selected AND the user tries to edit the task list name THEN the system SHALL disable the edit option
2. WHEN "All" is selected AND the user tries to delete the task list THEN the system SHALL disable the delete option
3. WHEN "All" is selected THEN the dropdown SHALL clearly indicate this is a view mode, not an editable task list
4. WHEN "All" is selected AND the user creates a new task THEN the system SHALL associate it with the Default task list
