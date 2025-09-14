# Implementation Plan

- [x] 1. Extend TaskService with week-based query methods
  - Add method to query tasks by week date range using scheduledDate field
  - Implement getTasksForWeek method that respects weekStartDay preference
  - Add method to get incomplete tasks (PENDING or IN_PROGRESS status) from specific week
  - Write unit tests for new query methods with different weekStartDay values
  - _Requirements: 1.1, 2.1, 3.3, 3.4_

- [x] 2. Create WeekTransitionDetector service
  - Implement detectWeekTransition method using weekStartDay preference from user settings
  - Create shouldShowMigrationPrompt method that checks preferences and dismissal history
  - Add getIncompleteTasksFromPreviousWeek method that queries TaskService
  - Implement week identifier generation for consistent week tracking
  - Write unit tests covering week boundary calculations and edge cases
  - _Requirements: 3.1, 3.2, 3.3, 3.4_
-

- [x] 3. Create MigrationPreferences service and data model
  - Define MigrationPreferences interface with enabled flag and dismissed weeks tracking
  - Implement MigrationPreferencesService with localStorage persistence
  - Add methods for managing dismissed weeks and migration settings
  - Create default preferences initialization
  - Write unit tests for preference persistence and retrieval
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 4. Build TaskMigrationDialog component
  - Create modal component using HeroUI Modal components following existing TaskModal pattern
  - Implement task list display with checkboxes, titles, priorities, and original scheduled dates
  - Add day picker for current week using existing DatePicker component
  - Create task selection state management with select all/clear all functionality
  - Add action buttons for "Migrate Selected", "Skip This Week", and "Don't Ask Again"
  - Write unit tests for component rendering and user interactions
  - _Requirements: 1.2, 1.3, 2.2, 4.1, 4.2, 5.1_

- [x] 5. Implement TaskMigrationService business logic
  - Create migrateTasksToWeek method that updates scheduledDate for selected tasks
  - Implement task migration validation to check for valid dates and task existence
  - Add error handling for failed migrations with detailed error messages
  - Create migration result summary with success/failure counts and day breakdown
  - Write unit tests for migration logic and error scenarios
  - _Requirements: 1.4, 2.3, 4.4, 4.5_

- [x] 6. Add migration hooks to WeekView component
  - Import WeekTransitionDetector and migration services
  - Add useEffect hook to detect week changes in onWeekChange handler
  - Implement migration prompt trigger when navigating to new week
  - Add state management for migration dialog visibility and data
  - Handle migration completion and UI refresh
  - Write integration tests for WeekView migration flow
  - _Requirements: 1.1, 1.2, 1.4, 1.5_

- [x] 7. Add migration hooks to DayView component
  - Import WeekTransitionDetector and check for week transitions in day navigation
  - Add migration prompt trigger when navigating to day in new week
  - Implement day-specific migration logic with current day as default target
  - Handle migration completion and day view refresh
  - Write integration tests for DayView migration flow
  - _Requirements: 2.1, 2.2, 2.4, 2.5_

- [x] 8. Extend user preferences to include migration settings
  - Add migration preferences to UserPreferences interface in types/index.ts
  - Update SettingsContext to include migration preferences
  - Add migration settings section to settings UI if needed
  - Ensure migration preferences are persisted with other user settings
  - Write tests for preference integration
  - _Requirements: 5.2, 5.3, 5.4, 5.5_

- [x] 9. Handle periodic task instances in migration logic
  - Update WeekTransitionDetector to exclude auto-generated periodic instances
  - Add logic to include overdue periodic instances in migration candidates
  - Ensure migrated periodic instances maintain template connections
  - Prevent interference with automatic periodic task generation
  - Write unit tests for periodic task migration scenarios
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 10. Add smart scheduling suggestions
  - Implement suggestSchedulingForTasks method in TaskMigrationService
  - Create scheduling algorithm based on task priority, time estimates, and existing schedule
  - Add visual indicators in migration dialog for suggested dates
  - Implement one-click acceptance of scheduling suggestions
  - Write unit tests for scheduling suggestion algorithms
  - _Requirements: 4.4, 4.5_
-

- [x] 11. Add dependency conflict detection and warnings
  - Extend migration validation to check for task dependencies
  - Display warnings when migrating tasks with dependencies in different weeks
  - Provide options to migrate dependent tasks together
  - Add visual indicators for tasks with dependency relationships
  - Write unit tests for dependency validation logic
  - _Requirements: 4.2, 4.3_
-

- [x] 12. Implement manual migration trigger
  - Add menu option or button to manually trigger migration dialog
  - Allow users to select any previous week for migration, not just immediately previous
  - Implement manual migration flow that bypasses automatic detection
  - Add manual migration option to both Week and Day views
  - Write tests for manual migration functionality
  - _Requirements: 5.4, 5.5_

-

- [x] 13. Add migration result feedback and summary
  - Create migration success/failure notification system using existing toast context
  - Display detailed migration summary with task counts by day
  - Show error details for failed migrations with retry options
  - Add undo functionality for recent migrations if feasible
  - Write tests for feedback and summary display
  - _Requirements: 4.5, 1.4, 2.5_

- [ ] 14. Add localization support for migration features
  - Define translation keys for all migration dialog text and messages
  - Add translations to existing locale files (en, es, fr, de, pt, ja, vi)
  - Implement proper pluralization for migration summary messages
  - Test migration dialog in different languages
  - Write tests to ensure all text is properly localized
  - _Requirements: 1.2, 2.2, 4.1, 4.5_
