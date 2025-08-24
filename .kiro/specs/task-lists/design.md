# Design Document

## Overview

The task lists feature adds organizational capabilities to KiraPilot by allowing users to group tasks into separate lists or projects. This feature introduces a new `task_lists` entity and modifies the existing `tasks` entity to include a `task_list_id` foreign key. The UI will be enhanced with a dropdown in the header for task list management and filtering capabilities in both week and day planners.

## Architecture

### Database Layer

#### New Entity: TaskList

- **Table**: `task_lists`
- **Primary Key**: `id` (String, UUID)
- **Fields**:
  - `id`: String (UUID, primary key)
  - `name`: String (task list name)
  - `is_default`: Boolean (marks the default task list)
  - `created_at`: DateTimeUtc
  - `updated_at`: DateTimeUtc

#### Modified Entity: Task

- **Existing Table**: `tasks`
- **New Field**: `task_list_id` (String, foreign key to task_lists.id)
- **Migration**: Add `task_list_id` column with default value pointing to the default task list

### Service Layer

#### TaskListRepository

New repository for managing task lists with the following methods:

- `create_task_list(name: String) -> Result<TaskList, DbErr>`
- `find_all_task_lists() -> Result<Vec<TaskList>, DbErr>`
- `find_by_id(id: String) -> Result<Option<TaskList>, DbErr>`
- `update_task_list(id: String, name: String) -> Result<TaskList, DbErr>`
- `delete_task_list(id: String) -> Result<(), DbErr>`
- `get_default_task_list() -> Result<TaskList, DbErr>`
- `ensure_default_task_list() -> Result<TaskList, DbErr>`

#### Modified TaskRepository

Enhanced with task list filtering:

- `find_by_task_list(task_list_id: String) -> Result<Vec<Task>, DbErr>`
- `move_task_to_list(task_id: String, task_list_id: String) -> Result<Task, DbErr>`
- `migrate_orphaned_tasks_to_default() -> Result<u64, DbErr>`

### Frontend Layer

#### Context Layer

- **TaskListContext**: New context for managing task list state
  - Current active task list
  - Available task lists
  - Task list operations (create, update, delete)

#### Component Updates

##### Header Component

- Add task list dropdown with the following options:
  - "All" (special view showing all tasks)
  - List of user-created task lists
  - "Default" task list
  - Separator
  - "Create New List..." option
  - "Edit Current List" option (when not "All")
  - "Delete Current List" option (when not "All" or "Default")

##### Planner Components

- Filter tasks based on selected task list
- Show task list indicator in task cards when "All" view is active
- Update task creation to associate with current task list

##### Task Modal/Form

- Add task list selector dropdown
- Allow moving tasks between lists during editing

## Components and Interfaces

### Database Entities

```rust
// New TaskList entity
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "task_lists")]
pub struct TaskListModel {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub name: String,
    pub is_default: bool,
    pub created_at: DateTimeUtc,
    pub updated_at: DateTimeUtc,
}

// Modified Task entity (add task_list_id field)
pub struct TaskModel {
    // ... existing fields
    pub task_list_id: String, // Foreign key to task_lists.id
    // ... rest of existing fields
}
```

### Frontend Types

```typescript
// New TaskList interface
export interface TaskList {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Special task list identifiers
export const TASK_LIST_ALL = '__ALL__';
export const TASK_LIST_DEFAULT = '__DEFAULT__';

// Task list selection state
export interface TaskListSelection {
  type: 'all' | 'specific';
  taskListId?: string;
  taskList?: TaskList;
}
```

### API Interfaces

```typescript
// Task list operations
export interface TaskListService {
  getAllTaskLists(): Promise<TaskList[]>;
  createTaskList(name: string): Promise<TaskList>;
  updateTaskList(id: string, name: string): Promise<TaskList>;
  deleteTaskList(id: string): Promise<void>;
  getDefaultTaskList(): Promise<TaskList>;
}

// Enhanced task operations
export interface EnhancedTaskService extends TaskService {
  getTasksByTaskList(taskListId: string): Promise<Task[]>;
  moveTaskToList(taskId: string, taskListId: string): Promise<Task>;
}
```

## Data Models

### Database Schema

```sql
-- New task_lists table
CREATE TABLE task_lists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

-- Add task_list_id to existing tasks table
ALTER TABLE tasks ADD COLUMN task_list_id TEXT REFERENCES task_lists(id);

-- Create index for performance
CREATE INDEX idx_tasks_task_list_id ON tasks(task_list_id);

-- Ensure only one default task list
CREATE UNIQUE INDEX idx_task_lists_default ON task_lists(is_default) WHERE is_default = TRUE;
```

### Migration Strategy

1. **Create task_lists table**
2. **Create default task list** with name "Default"
3. **Add task_list_id column** to tasks table
4. **Migrate existing tasks** to default task list
5. **Add foreign key constraint** and indexes

## Error Handling

### Database Level

- **Constraint violations**: Handle unique constraint on default task list
- **Foreign key violations**: Prevent deletion of task lists with associated tasks
- **Transaction failures**: Ensure atomic operations for task list operations

### Frontend Level

- **Network errors**: Graceful degradation with local state
- **Validation errors**: User-friendly error messages for invalid task list names
- **Deletion conflicts**: Confirm dialog with clear explanation of consequences

### Business Logic

- **Default task list protection**: Prevent deletion or modification of default task list name
- **Orphaned tasks**: Automatic migration to default task list
- **Empty task list names**: Validation and auto-generation of names

## Testing Strategy

### Unit Tests

#### Backend Tests

- **TaskListRepository**: CRUD operations, constraint handling
- **TaskRepository**: Task list filtering, task migration
- **Migration**: Database schema changes, data migration

#### Frontend Tests

- **TaskListContext**: State management, operations
- **Header component**: Dropdown behavior, task list switching
- **Planner components**: Task filtering, task list indicators

### Integration Tests

- **End-to-end task list workflow**: Create, switch, filter, delete
- **Task migration**: Moving tasks between lists
- **Database consistency**: Foreign key relationships, default task list

### Edge Cases

- **Concurrent operations**: Multiple users, race conditions
- **Large datasets**: Performance with many task lists and tasks
- **Migration scenarios**: Upgrading from version without task lists

## UI/UX Considerations

### Task List Dropdown Design

- **Visual hierarchy**: Clear separation between "All", user lists, and actions
- **Keyboard navigation**: Arrow keys, Enter, Escape support
- **Loading states**: Skeleton loading for task list operations
- **Empty states**: Guidance when no custom task lists exist

### Task List Indicators

- **Subtle badges**: Show task list name in task cards when "All" view is active
- **Color coding**: Optional color assignment for task lists (future enhancement)
- **Consistent iconography**: Use consistent icons for task list operations

### Responsive Design

- **Mobile considerations**: Collapsible dropdown, touch-friendly interactions
- **Tablet layout**: Optimized spacing and touch targets
- **Desktop experience**: Keyboard shortcuts, hover states

## Performance Considerations

### Database Optimization

- **Indexes**: Proper indexing on task_list_id for fast filtering
- **Query optimization**: Efficient joins between tasks and task_lists
- **Batch operations**: Bulk task migration for better performance

### Frontend Optimization

- **Memoization**: Cache task list data to avoid unnecessary re-renders
- **Lazy loading**: Load task lists on demand
- **Optimistic updates**: Immediate UI feedback with rollback on errors

### Caching Strategy

- **Task list cache**: In-memory cache for frequently accessed task lists
- **Invalidation**: Smart cache invalidation on task list changes
- **Persistence**: Local storage backup for offline scenarios
