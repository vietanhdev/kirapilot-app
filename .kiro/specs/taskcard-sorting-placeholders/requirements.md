# Requirements Document

## Introduction

This feature enhances the existing drag-and-drop functionality in KiraPilot by adding visual placeholders when dragging task cards within columns. When a user drags a task card through other cards in the same column, a green line placeholder will appear between other cards to indicate where the task will be dropped, providing clear visual feedback for precise task reordering.

## Requirements

### Requirement 1

**User Story:** As a user, I want to see a visual placeholder when dragging a task card within a column so that I know exactly where the task will be positioned when I drop it.

#### Acceptance Criteria

1. WHEN the user starts dragging a task card within a column THEN the system SHALL show the dragged card with reduced opacity
2. WHEN the user drags a task card over other tasks in the same column THEN the system SHALL display a green line placeholder between tasks to indicate the drop position
3. WHEN the user moves the dragged task to different positions THEN the system SHALL update the green line placeholder position in real-time
4. WHEN the user drags a task card outside the current column THEN the system SHALL hide the green line placeholder and show column-level drop indicators

### Requirement 2

**User Story:** As a user, I want the green line placeholder to be visually distinct and clear so that I can easily see where my task will be dropped.

#### Acceptance Criteria

1. WHEN a green line placeholder is displayed THEN the system SHALL render it as a 2-3 pixel thick horizontal line with green color (#10B981 or similar)
2. WHEN the placeholder line is shown THEN the system SHALL add subtle animation or glow effect to make it more visible
3. WHEN the placeholder appears THEN the system SHALL ensure it spans the full width of the task card area with appropriate margins
4. WHEN multiple placeholders could be shown THEN the system SHALL only display one placeholder at the closest drop position

### Requirement 3

**User Story:** As a user, I want the placeholder to appear smoothly and responsively so that the drag-and-drop experience feels natural and polished.

#### Acceptance Criteria

1. WHEN the placeholder line appears or moves THEN the system SHALL animate the transition smoothly over 150-200ms
2. WHEN the user drags quickly through multiple positions THEN the system SHALL update the placeholder position without lag or flickering
3. WHEN the user hovers over a valid drop position for more than 100ms THEN the system SHALL show the placeholder line
4. WHEN the user moves away from a drop position THEN the system SHALL hide the placeholder line with a smooth fade-out animation

### Requirement 4

**User Story:** As a user, I want the drag-and-drop sorting to work consistently across all task columns so that I have a uniform experience throughout the application.

#### Acceptance Criteria

1. WHEN dragging tasks in the WeekView columns THEN the system SHALL show green line placeholders consistently across all day columns and special columns (backlog, upcoming)
2. WHEN dragging tasks in the DayView columns THEN the system SHALL show green line placeholders consistently across all status columns (backlog, today, next tasks, etc.)
3. WHEN dragging tasks in any column type THEN the system SHALL maintain the same visual styling and behavior for placeholders
4. WHEN the column has different heights or widths THEN the system SHALL adapt the placeholder line width accordingly

### Requirement 5

**User Story:** As a user, I want the placeholder system to work seamlessly with the existing drag-and-drop functionality so that I don't lose any current capabilities.

#### Acceptance Criteria

1. WHEN using the new placeholder system THEN the system SHALL maintain all existing drag-and-drop functionality for moving tasks between columns
2. WHEN dragging between columns THEN the system SHALL hide task-level placeholders and show column-level drop indicators as before
3. WHEN dropping a task with the placeholder system THEN the system SHALL update the task order correctly using the existing onInlineEdit callback
4. WHEN the drag operation is cancelled (ESC key or drag outside valid area) THEN the system SHALL hide all placeholders and return the task to its original position

### Requirement 6

**User Story:** As a user, I want the placeholder system to handle edge cases gracefully so that it works reliably in all scenarios.

#### Acceptance Criteria

1. WHEN dragging the first task in a column THEN the system SHALL show placeholder lines above and below other tasks as appropriate
2. WHEN dragging the last task in a column THEN the system SHALL show placeholder lines above other tasks and at the bottom of the column
3. WHEN a column has only one task THEN the system SHALL show placeholder lines above and below the single task when dragging from another column
4. WHEN a column is empty THEN the system SHALL show the existing empty state drop indicator instead of task-level placeholders

### Requirement 7

**User Story:** As a user, I want the placeholder system to be accessible and work with keyboard navigation so that all users can benefit from the improved visual feedback.

#### Acceptance Criteria

1. WHEN using keyboard navigation for drag-and-drop THEN the system SHALL provide audio or visual cues about the current drop position
2. WHEN using screen readers THEN the system SHALL announce the current drop position during keyboard-based drag operations
3. WHEN the placeholder is shown THEN the system SHALL ensure sufficient color contrast for users with visual impairments
4. WHEN keyboard focus moves during drag operations THEN the system SHALL update placeholder positions accordingly

### Requirement 8

**User Story:** As a user, I want the placeholder system to perform well and not impact the responsiveness of the application.

#### Acceptance Criteria

1. WHEN dragging tasks with placeholders enabled THEN the system SHALL maintain smooth 60fps performance during drag operations
2. WHEN calculating placeholder positions THEN the system SHALL use efficient algorithms that don't cause UI lag
3. WHEN multiple tasks are being dragged simultaneously (future feature) THEN the system SHALL handle placeholder calculations efficiently
4. WHEN the column contains many tasks (50+) THEN the system SHALL maintain responsive placeholder updates without performance degradation
