# Implementation Plan

- [x] 1. Create database foundation for task lists
  - Create TaskList entity with SeaORM model and relations
  - Implement database migration to add task_lists table and task_list_id column to tasks
  - Write unit tests for TaskList entity and migration
  - _Requirements: 5.3, 5.4_

- [x] 2. Implement TaskListRepository with core operations
  - Create TaskListRepository with CRUD operations (create, find_all, find_by_id, update, delete)
  - Implement default task list management (get_default, ensure_default)
  - Add task list validation and constraint handling
  - Write comprehensive unit tests for all repository methods
  - _Requirements: 1.1, 1.3, 4.1, 4.5_

- [x] 3. Enhance TaskRepository with task list filtering
  - Add find_by_task_list method to filter tasks by task list ID
  - Implement move_task_to_list method for moving tasks between lists
  - Add migrate_orphaned_tasks_to_default method for data consistency
  - Update existing task creation to include task_list_id
  - Write unit tests for new task repository methods
  - _Requirements: 2.3, 2.4, 5.1, 7.2, 7.3_

- [x] 4. Create frontend TaskList types and interfaces
  - Define TaskList interface and related types in TypeScript
  - Create TaskListSelection interface for managing current selection state
  - Add special constants for "All" and "Default" task list identifiers
  - Create TaskListService interface for frontend-backend communication
  - _Requirements: 2.1, 2.3, 8.3_

- [x] 5. Implement TaskListContext for state management
  - Create TaskListContext with state for current selection and available task lists
  - Implement task list operations (create, update, delete, switch)
  - Add persistence logic for remembering selected task list across sessions
  - Handle loading states and error handling for task list operations
  - Write unit tests for TaskListContext logic
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 6. Create TaskListDropdown component
  - Build dropdown component with "All", task lists, and management options
  - Implement create new task list functionality with name input
  - Add edit current task list name functionality
  - Implement delete task list with confirmation dialog
  - Add keyboard navigation and accessibility features
  - Write unit tests for dropdown component interactions
  - _Requirements: 1.1, 1.2, 1.4, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 8.1, 8.2_

- [x] 7. Integrate TaskListDropdown into Header component
  - Add TaskListDropdown to Header component layout
  - Connect dropdown to TaskListContext for state management
  - Ensure proper styling and responsive design
  - Test dropdown behavior with existing header functionality
  - _Requirements: 2.1, 2.2_

- [x] 8. Update Planner components for task list filtering
  - Modify WeeklyPlan component to filter tasks by selected task list
  - Update DayView component to respect task list filtering
  - Add task list indicators to task cards when "All" view is active
  - Ensure task creation associates with current task list selection
  - Write unit tests for filtering logic
  - _Requirements: 2.4, 2.5, 5.1, 5.2_

- [x] 9. Enhance TaskModal with task list selection
  - Add task list selector dropdown to task creation/editing modal
  - Implement task list switching functionality within task editing
  - Update task creation flow to use selected task list
  - Add validation and error handling for task list operations
  - Write unit tests for task modal task list functionality
  - _Requirements: 7.1, 7.2, 7.4_

- [x] 10. Implement database migration and data initialization
  - Create migration script to add task_lists table and modify tasks table
  - Implement automatic creation of default task list on first run
  - Add migration logic to move existing tasks to default task list
  - Test migration with existing database data
  - Write integration tests for migration process
  - _Requirements: 5.3, 5.4, 5.5_

- [x] 11. Add comprehensive error handling and validation
  - Implement frontend validation for task list names (non-empty, reasonable length)
  - Add backend validation and constraint handling
  - Create user-friendly error messages for all failure scenarios
  - Implement rollback logic for failed operations
  - Test error scenarios and edge cases
  - _Requirements: 1.4, 3.3, 4.5_

- [x] 12. Write integration tests for complete task list workflow
  - Test end-to-end task list creation, switching, and deletion
  - Verify task filtering works correctly across all views
  - Test task migration between lists
  - Validate persistence of task list selection across app restarts
  - Test concurrent operations and race condition handling
  - _Requirements: 2.2, 2.3, 6.1, 6.2, 7.3_
