# Tauri Commands API Reference

This document provides comprehensive documentation for all Tauri commands available in KiraPilot.

_Generated on: 2025-08-24T14:14:12.210Z_

## Table of Contents

- [AI Interactions](#ai-interactions)
- [Data Management](#data-management)
- [Database Management](#database-management)
- [Task Management](#task-management)
- [Time Tracking](#time-tracking)
- [Utilities](#utilities)

## Overview

KiraPilot uses Tauri commands to communicate between the frontend (TypeScript/React) and backend (Rust). All commands are asynchronous and return promises.

### Basic Usage

```typescript
import { invoke } from '@tauri-apps/api/core';

// Example command invocation
const result = await invoke('command_name', {
  parameter1: 'value1',
  parameter2: 'value2',
});
```

## AI Interactions

### `create_ai_interaction`

AI Interactions operation: create ai interaction

**Parameters:**

- `request` (CreateAiInteractionRequest) - **required** - Request object containing the data

**Returns:** `Result<serde_json::Value, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('create_ai_interaction', {
  request: {
    // CreateAiInteractionRequest properties
  },
});
console.log(result);
```

---

### `get_ai_interaction`

AI Interactions operation: get ai interaction

**Parameters:**

- `id` (String) - **required** - Unique identifier

**Returns:** `Result<Option<serde_json::Value>, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_ai_interaction', {
  id: 'example_id',
});
console.log(result);
```

---

### `get_all_ai_interactions`

AI Interactions operation: get all ai interactions

**Parameters:**

- `limit` (Option<u64>) - _optional_ - Maximum number of results to return
- `offset` (Option<u64>) - _optional_ - offset parameter

**Returns:** `Result<Vec<serde_json::Value>, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_all_ai_interactions', {
  limit: 'limit_value',
  offset: 'offset_value',
});
console.log(result);
```

---

### `get_ai_interactions_between`

AI Interactions operation: get ai interactions between

**Parameters:**

- `start_date` (String) - **required** - Start date in ISO 8601 format
- `end_date` (String) - **required** - End date in ISO 8601 format

**Returns:** `Result<Vec<serde_json::Value>, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_ai_interactions_between', {
  start_date: 'example_start_date',
  end_date: 'example_end_date',
});
console.log(result);
```

---

### `search_ai_interactions`

AI Interactions operation: search ai interactions

**Parameters:**

- `query` (String) - **required** - Search query string

**Returns:** `Result<Vec<serde_json::Value>, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('search_ai_interactions', {
  query: 'example_query',
});
console.log(result);
```

---

### `update_ai_interaction`

AI Interactions operation: update ai interaction

**Parameters:**

- `id` (String) - **required** - Unique identifier
- `request` (UpdateAiInteractionRequest) - **required** - Request object containing the data

**Returns:** `Result<serde_json::Value, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('update_ai_interaction', {
  id: 'example_id',
  request: {
    // UpdateAiInteractionRequest properties
  },
});
console.log(result);
```

---

### `delete_ai_interaction`

AI Interactions operation: delete ai interaction

**Parameters:**

- `id` (String) - **required** - Unique identifier

**Returns:** `Result<String, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('delete_ai_interaction', {
  id: 'example_id',
});
console.log(result);
```

---

### `get_ai_stats`

AI Interactions operation: get ai stats

**Parameters:** None

**Returns:** `Result<AiStats, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_ai_stats', {});
console.log(result);
```

---

### `get_recent_ai_interactions`

AI Interactions operation: get recent ai interactions

**Parameters:**

- `limit` (u64) - **required** - Maximum number of results to return

**Returns:** `Result<Vec<serde_json::Value>, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_recent_ai_interactions', {
  limit: 42,
});
console.log(result);
```

---

### `clear_old_ai_interactions`

AI Interactions operation: clear old ai interactions

**Parameters:**

- `older_than_days` (u64) - **required** - older than days parameter

**Returns:** `Result<u64, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('clear_old_ai_interactions', {
  older_than_days: 42,
});
console.log(result);
```

---

### `get_conversation_history`

AI Interactions operation: get conversation history

**Parameters:**

- `limit` (u64) - **required** - Maximum number of results to return

**Returns:** `Result<Vec<serde_json::Value>, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_conversation_history', {
  limit: 42,
});
console.log(result);
```

---

## Data Management

### `validate_backup_file`

Data Management operation: validate backup file

**Parameters:**

- `file_path` (String) - **required** - file path parameter

**Returns:** `Result<BackupMetadata, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('validate_backup_file', {
  file_path: 'example_file_path',
});
console.log(result);
```

---

### `validate_backup_comprehensive`

Data Management operation: validate backup comprehensive

**Parameters:**

- `file_path` (String) - **required** - file path parameter

**Returns:** `Result<backup::BackupValidationResult, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('validate_backup_comprehensive', {
  file_path: 'example_file_path',
});
console.log(result);
```

---

## Database Management

### `init_database`

Initializes the database with required tables

**Parameters:** None

**Returns:** `Result<String, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('init_database', {});
console.log(result);
```

---

### `get_database_health`

Database Management operation: get database health

**Parameters:** None

**Returns:** `Result<DatabaseHealth, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_database_health', {});
console.log(result);
```

---

### `get_migration_status_cmd`

Database Management operation: get migration status cmd

**Parameters:** None

**Returns:** `Result<MigrationStatus, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_migration_status_cmd', {});
console.log(result);
```

---

### `test_migration_compatibility_cmd`

Database Management operation: test migration compatibility cmd

**Parameters:** None

**Returns:** `Result<MigrationTestResult, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('test_migration_compatibility_cmd', {});
console.log(result);
```

---

### `run_post_migration_initialization`

Database Management operation: run post migration initialization

**Parameters:** None

**Returns:** `Result<String, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('run_post_migration_initialization', {});
console.log(result);
```

---

### `validate_database_integrity`

Database Management operation: validate database integrity

**Parameters:** None

**Returns:** `Result<DatabaseIntegrityReport, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('validate_database_integrity', {});
console.log(result);
```

---

## Task Management

### `create_task`

Creates a new task with the specified properties

**Parameters:**

- `request` (CreateTaskRequest) - **required** - Request object containing the data

**Returns:** `Result<serde_json::Value, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('create_task', {
  request: {
    // CreateTaskRequest properties
  },
});
console.log(result);
```

---

### `get_task`

Retrieves a task by its unique identifier

**Parameters:**

- `id` (String) - **required** - Unique identifier

**Returns:** `Result<Option<serde_json::Value>, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_task', {
  id: 'example_id',
});
console.log(result);
```

---

### `get_task_with_dependencies`

Task Management operation: get task with dependencies

**Parameters:**

- `id` (String) - **required** - Unique identifier

**Returns:** `Result<Option<serde_json::Value>, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_task_with_dependencies', {
  id: 'example_id',
});
console.log(result);
```

---

### `get_all_tasks`

Retrieves all tasks with optional filtering

**Parameters:**

- `status` (Option<String>) - _optional_ - status parameter
- `project_id` (Option<String>) - _optional_ - project id parameter

**Returns:** `Result<Vec<serde_json::Value>, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_all_tasks', {
  status: 'status_value',
  project_id: 'project_id_value',
});
console.log(result);
```

---

### `get_scheduled_tasks`

Task Management operation: get scheduled tasks

**Parameters:**

- `start_date` (String) - **required** - Start date in ISO 8601 format
- `end_date` (String) - **required** - End date in ISO 8601 format

**Returns:** `Result<Vec<serde_json::Value>, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_scheduled_tasks', {
  start_date: 'example_start_date',
  end_date: 'example_end_date',
});
console.log(result);
```

---

### `get_backlog_tasks`

Task Management operation: get backlog tasks

**Parameters:** None

**Returns:** `Result<Vec<serde_json::Value>, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_backlog_tasks', {});
console.log(result);
```

---

### `update_task`

Updates an existing task with new properties

**Parameters:**

- `id` (String) - **required** - Unique identifier
- `request` (UpdateTaskRequest) - **required** - Request object containing the data

**Returns:** `Result<serde_json::Value, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('update_task', {
  id: 'example_id',
  request: {
    // UpdateTaskRequest properties
  },
});
console.log(result);
```

---

### `delete_task`

Permanently deletes a task

**Parameters:**

- `id` (String) - **required** - Unique identifier

**Returns:** `Result<String, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('delete_task', {
  id: 'example_id',
});
console.log(result);
```

---

### `add_task_dependency`

Task Management operation: add task dependency

**Parameters:**

- `task_id` (String) - **required** - task id parameter
- `depends_on_id` (String) - **required** - depends on id parameter

**Returns:** `Result<serde_json::Value, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('add_task_dependency', {
  task_id: 'example_task_id',
  depends_on_id: 'example_depends_on_id',
});
console.log(result);
```

---

### `remove_task_dependency`

Task Management operation: remove task dependency

**Parameters:**

- `task_id` (String) - **required** - task id parameter
- `depends_on_id` (String) - **required** - depends on id parameter

**Returns:** `Result<String, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('remove_task_dependency', {
  task_id: 'example_task_id',
  depends_on_id: 'example_depends_on_id',
});
console.log(result);
```

---

### `get_task_dependencies`

Task Management operation: get task dependencies

**Parameters:**

- `task_id` (String) - **required** - task id parameter

**Returns:** `Result<Vec<serde_json::Value>, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_task_dependencies', {
  task_id: 'example_task_id',
});
console.log(result);
```

---

### `get_task_dependents`

Task Management operation: get task dependents

**Parameters:**

- `task_id` (String) - **required** - task id parameter

**Returns:** `Result<Vec<serde_json::Value>, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_task_dependents', {
  task_id: 'example_task_id',
});
console.log(result);
```

---

### `get_task_stats`

Retrieves statistical information about tasks

**Parameters:** None

**Returns:** `Result<TaskStats, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_task_stats', {});
console.log(result);
```

---

### `search_tasks`

Task Management operation: search tasks

**Parameters:**

- `query` (String) - **required** - Search query string

**Returns:** `Result<Vec<serde_json::Value>, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('search_tasks', {
  query: 'example_query',
});
console.log(result);
```

---

### `get_task_sessions`

Task Management operation: get task sessions

**Parameters:**

- `task_id` (String) - **required** - task id parameter

**Returns:** `Result<Vec<serde_json::Value>, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_task_sessions', {
  task_id: 'example_task_id',
});
console.log(result);
```

---

### `get_task_total_time`

Task Management operation: get task total time

**Parameters:**

- `task_id` (String) - **required** - task id parameter

**Returns:** `Result<i64, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_task_total_time', {
  task_id: 'example_task_id',
});
console.log(result);
```

---

### `get_sessions_with_tasks`

Task Management operation: get sessions with tasks

**Parameters:**

- `start_date` (String) - **required** - Start date in ISO 8601 format
- `end_date` (String) - **required** - End date in ISO 8601 format

**Returns:** `Result<Vec<serde_json::Value>, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_sessions_with_tasks', {
  start_date: 'example_start_date',
  end_date: 'example_end_date',
});
console.log(result);
```

---

### `clear_all_data`

Removes all data from the database (destructive operation)

**Parameters:** None

**Returns:** `Result<String, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('clear_all_data', {});
console.log(result);
```

---

### `get_all_task_lists`

Task Management operation: get all task lists

**Parameters:** None

**Returns:** `Result<Vec<serde_json::Value>, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_all_task_lists', {});
console.log(result);
```

---

### `create_task_list`

Task Management operation: create task list

**Parameters:**

- `request` (CreateTaskListRequest) - **required** - Request object containing the data

**Returns:** `Result<serde_json::Value, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('create_task_list', {
  request: {
    // CreateTaskListRequest properties
  },
});
console.log(result);
```

---

### `update_task_list`

Task Management operation: update task list

**Parameters:**

- `id` (String) - **required** - Unique identifier
- `request` (UpdateTaskListRequest) - **required** - Request object containing the data

**Returns:** `Result<serde_json::Value, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('update_task_list', {
  id: 'example_id',
  request: {
    // UpdateTaskListRequest properties
  },
});
console.log(result);
```

---

### `delete_task_list`

Task Management operation: delete task list

**Parameters:**

- `id` (String) - **required** - Unique identifier

**Returns:** `Result<String, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('delete_task_list', {
  id: 'example_id',
});
console.log(result);
```

---

### `get_default_task_list`

Task Management operation: get default task list

**Parameters:** None

**Returns:** `Result<serde_json::Value, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_default_task_list', {});
console.log(result);
```

---

### `move_task_to_list`

Task Management operation: move task to list

**Parameters:**

- `taskId` (String) - **required** - taskId parameter
- `taskListId` (String) - **required** - taskListId parameter

**Returns:** `Result<serde_json::Value, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('move_task_to_list', {
  taskId: 'example_taskId',
  taskListId: 'example_taskListId',
});
console.log(result);
```

---

### `get_tasks_by_task_list`

Task Management operation: get tasks by task list

**Parameters:**

- `task_list_id` (String) - **required** - task list id parameter

**Returns:** `Result<Vec<serde_json::Value>, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_tasks_by_task_list', {
  task_list_id: 'example_task_list_id',
});
console.log(result);
```

---

### `get_task_list_stats`

Task Management operation: get task list stats

**Parameters:** None

**Returns:** `Result<TaskListStats, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_task_list_stats', {});
console.log(result);
```

---

## Time Tracking

### `create_time_session`

Starts a new time tracking session

**Parameters:**

- `request` (CreateTimeSessionRequest) - **required** - Request object containing the data

**Returns:** `Result<serde_json::Value, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('create_time_session', {
  request: {
    // CreateTimeSessionRequest properties
  },
});
console.log(result);
```

---

### `get_time_session`

Time Tracking operation: get time session

**Parameters:**

- `id` (String) - **required** - Unique identifier

**Returns:** `Result<Option<serde_json::Value>, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_time_session', {
  id: 'example_id',
});
console.log(result);
```

---

### `get_active_session`

Time Tracking operation: get active session

**Parameters:**

- `task_id` (String) - **required** - task id parameter

**Returns:** `Result<Option<serde_json::Value>, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_active_session', {
  task_id: 'example_task_id',
});
console.log(result);
```

---

### `get_any_active_session`

Time Tracking operation: get any active session

**Parameters:** None

**Returns:** `Result<Option<serde_json::Value>, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_any_active_session', {});
console.log(result);
```

---

### `get_sessions_between`

Time Tracking operation: get sessions between

**Parameters:**

- `start_date` (String) - **required** - Start date in ISO 8601 format
- `end_date` (String) - **required** - End date in ISO 8601 format

**Returns:** `Result<Vec<serde_json::Value>, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_sessions_between', {
  start_date: 'example_start_date',
  end_date: 'example_end_date',
});
console.log(result);
```

---

### `update_time_session`

Time Tracking operation: update time session

**Parameters:**

- `id` (String) - **required** - Unique identifier
- `request` (UpdateTimeSessionRequest) - **required** - Request object containing the data

**Returns:** `Result<serde_json::Value, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('update_time_session', {
  id: 'example_id',
  request: {
    // UpdateTimeSessionRequest properties
  },
});
console.log(result);
```

---

### `stop_time_session`

Stops an active time tracking session

**Parameters:**

- `id` (String) - **required** - Unique identifier
- `notes` (Option<String>) - _optional_ - notes parameter

**Returns:** `Result<serde_json::Value, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('stop_time_session', {
  id: 'example_id',
  notes: 'notes_value',
});
console.log(result);
```

---

### `pause_time_session`

Time Tracking operation: pause time session

**Parameters:**

- `id` (String) - **required** - Unique identifier

**Returns:** `Result<serde_json::Value, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('pause_time_session', {
  id: 'example_id',
});
console.log(result);
```

---

### `resume_time_session`

Time Tracking operation: resume time session

**Parameters:**

- `id` (String) - **required** - Unique identifier

**Returns:** `Result<serde_json::Value, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('resume_time_session', {
  id: 'example_id',
});
console.log(result);
```

---

### `delete_time_session`

Time Tracking operation: delete time session

**Parameters:**

- `id` (String) - **required** - Unique identifier

**Returns:** `Result<String, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('delete_time_session', {
  id: 'example_id',
});
console.log(result);
```

---

### `get_time_stats`

Time Tracking operation: get time stats

**Parameters:**

- `start_date` (String) - **required** - Start date in ISO 8601 format
- `end_date` (String) - **required** - End date in ISO 8601 format

**Returns:** `Result<TimeStats, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_time_stats', {
  start_date: 'example_start_date',
  end_date: 'example_end_date',
});
console.log(result);
```

---

### `get_recent_sessions`

Time Tracking operation: get recent sessions

**Parameters:**

- `limit` (u64) - **required** - Maximum number of results to return

**Returns:** `Result<Vec<serde_json::Value>, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_recent_sessions', {
  limit: 42,
});
console.log(result);
```

---

## Utilities

### `greet`

Utilities operation: greet

**Parameters:**

- `name` (&str) - **required** - name parameter

**Returns:** `String`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('greet', {
  name: 'example_name',
});
console.log(result);
```

---

### `export_data_to_file`

Utilities operation: export data to file

**Parameters:**

- `file_path` (String) - **required** - file path parameter

**Returns:** `Result<BackupMetadata, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('export_data_to_file', {
  file_path: 'example_file_path',
});
console.log(result);
```

---

### `import_data_from_file`

Utilities operation: import data from file

**Parameters:**

- `file_path` (String) - **required** - file path parameter
- `overwrite` (bool) - **required** - overwrite parameter

**Returns:** `Result<BackupMetadata, String>`

**Example:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('import_data_from_file', {
  file_path: 'example_file_path',
  overwrite: true,
});
console.log(result);
```

---

## Data Types

The following data types are used in request and response objects:

### CreateAiInteractionRequest

_Defined in: ai_repository.rs_

**Fields:**

- pub message: String
- pub response: String
- pub action_taken: Option<String>
- pub reasoning: Option<String>
- pub tools_used: Option<Vec<String>>
- // Will be serialized to JSON
  pub confidence: Option<f64>

### UpdateAiInteractionRequest

_Defined in: ai_repository.rs_

**Fields:**

- pub response: Option<String>
- pub action_taken: Option<String>
- pub reasoning: Option<String>
- pub tools_used: Option<Vec<String>>
- // Will be serialized to JSON
  pub confidence: Option<f64>

### AiStats

_Defined in: ai_repository.rs_

**Fields:**

- pub total_interactions: u64
- pub average_confidence: f64
- pub most_common_actions: Vec<ActionCount>
- pub most_used_tools: Vec<ToolCount>

### ToolCount

_Defined in: ai_repository.rs_

**Fields:**

- pub tool: String
- pub count: u64

### ActionCount

_Defined in: ai_repository.rs_

**Fields:**

- pub action: String
- pub count: u64

### CreateFocusSessionRequest

_Defined in: focus_repository.rs_

**Fields:**

- pub task_id: String
- pub planned_duration: i32
- pub distraction_level: String
- pub background_audio: Option<String>
- pub notes: Option<String>

### UpdateFocusSessionRequest

_Defined in: focus_repository.rs_

**Fields:**

- pub actual_duration: Option<i32>
- pub focus_score: Option<f64>
- pub distraction_count: Option<i32>
- pub distraction_level: Option<String>
- pub background_audio: Option<String>
- pub notes: Option<String>
- pub breaks: Option<Vec<FocusBreak>>
- pub metrics: Option<FocusMetrics>
- pub completed_at: Option<chrono::DateTime<chrono::Utc>>

### FocusBreak

_Defined in: focus_repository.rs_

**Fields:**

- pub start_time: chrono::DateTime<chrono::Utc>
- pub end_time: chrono::DateTime<chrono::Utc>
- pub break_type: String
- // "short"
- "long"
- "distraction"
  pub reason: Option<String>

### FocusMetrics

_Defined in: focus_repository.rs_

**Fields:**

- pub deep_work_percentage: f64
- pub interruption_count: i32
- pub flow_state_duration: i32
- pub productivity_rating: Option<i32>
- pub energy_level_start: Option<i32>
- pub energy_level_end: Option<i32>

### FocusStats

_Defined in: focus_repository.rs_

**Fields:**

- pub total_sessions: u64
- pub total_planned_minutes: i64
- pub total_actual_minutes: i64
- pub average_focus_score: f64
- pub completion_rate: f64
- pub most_productive_distraction_level: String
- pub sessions_by_day: Vec<DayFocusStats>

### DayFocusStats

_Defined in: focus_repository.rs_

**Fields:**

- pub date: chrono::NaiveDate
- pub session_count: u64
- pub total_planned_minutes: i64
- pub total_actual_minutes: i64
- pub average_focus_score: f64

### CreatePatternRequest

_Defined in: pattern_repository.rs_

**Fields:**

- pub user_id: String
- pub pattern_type: String
- pub time_slot: String
- pub productivity_score: f64
- pub confidence_level: f64
- pub sample_size: i32

### UpdatePatternRequest

_Defined in: pattern_repository.rs_

**Fields:**

- pub productivity_score: Option<f64>
- pub confidence_level: Option<f64>
- pub sample_size: Option<i32>

### ProductivityInsights

_Defined in: pattern_repository.rs_

**Fields:**

- pub most_productive_hours: Vec<String>
- pub least_productive_hours: Vec<String>
- pub best_days_of_week: Vec<String>
- pub optimal_session_length: Option<i32>
- pub focus_patterns: Vec<FocusPattern>
- pub recommendations: Vec<String>

### FocusPattern

_Defined in: pattern_repository.rs_

**Fields:**

- pub pattern_type: String
- pub time_slot: String
- pub productivity_score: f64
- pub confidence_level: f64
- pub sample_size: i32
- pub trend: String
- // "improving"
- "declining"
- "stable"

### PatternStats

_Defined in: pattern_repository.rs_

**Fields:**

- pub total_patterns: u64
- pub high_confidence_patterns: u64
- pub average_productivity_score: f64
- pub patterns_by_type: std::collections::HashMap<String
- u64>

### CreateTaskListRequest

_Defined in: task_list_repository.rs_

**Fields:**

- pub name: String

### UpdateTaskListRequest

_Defined in: task_list_repository.rs_

**Fields:**

- pub name: String

### TaskListStats

_Defined in: task_list_repository.rs_

**Fields:**

- pub total_lists: u64
- pub lists_with_tasks: u64
- pub empty_lists: u64

### CreateTaskRequest

_Defined in: task_repository.rs_

**Fields:**

- pub title: String
- pub description: Option<String>
- pub priority: i32
- pub status: Option<String>
- pub dependencies: Option<Vec<String>>
- pub time_estimate: Option<i32>
- pub due_date: Option<chrono::DateTime<chrono::Utc>>
- pub scheduled_date: Option<chrono::DateTime<chrono::Utc>>
- pub tags: Option<Vec<String>>
- pub project_id: Option<String>
- pub parent_task_id: Option<String>
- pub task_list_id: Option<String>

### UpdateTaskRequest

_Defined in: task_repository.rs_

**Fields:**

- pub title: Option<String>
- pub description: Option<String>
- pub priority: Option<i32>
- pub status: Option<String>
- pub dependencies: Option<Vec<String>>
- pub time_estimate: Option<i32>
- pub actual_time: Option<i32>
- pub due_date: Option<chrono::DateTime<chrono::Utc>>
- pub scheduled_date: Option<chrono::DateTime<chrono::Utc>>
- pub tags: Option<Vec<String>>
- pub project_id: Option<String>
- pub parent_task_id: Option<String>
- pub task_list_id: Option<String>
- pub completed_at: Option<chrono::DateTime<chrono::Utc>>

### TaskStats

_Defined in: task_repository.rs_

**Fields:**

- pub total: u64
- pub completed: u64
- pub in_progress: u64
- pub pending: u64

### CreateTimeSessionRequest

_Defined in: time_tracking_repository.rs_

**Fields:**

- pub task_id: String
- pub start_time: chrono::DateTime<chrono::Utc>
- pub notes: Option<String>

### UpdateTimeSessionRequest

_Defined in: time_tracking_repository.rs_

**Fields:**

- pub end_time: Option<chrono::DateTime<chrono::Utc>>
- pub paused_time: Option<i32>
- pub is_active: Option<bool>
- pub notes: Option<String>
- pub breaks: Option<Vec<TimeBreak>>

### TimeBreak

_Defined in: time_tracking_repository.rs_

**Fields:**

- pub start_time: chrono::DateTime<chrono::Utc>
- pub end_time: chrono::DateTime<chrono::Utc>
- pub reason: Option<String>

### TimeStats

_Defined in: time_tracking_repository.rs_

**Fields:**

- pub total_sessions: u64
- pub total_time_minutes: i64
- pub total_work_time_minutes: i64
- pub total_break_time_minutes: i64
- pub average_session_minutes: f64
- pub average_productivity_score: f64
- pub most_productive_hour: Option<u32>
- pub sessions_by_day: Vec<DayStats>

### DayStats

_Defined in: time_tracking_repository.rs_

**Fields:**

- pub date: chrono::NaiveDate
- pub total_minutes: i64
- pub session_count: u64

## Error Handling

All Tauri commands can throw errors. It's recommended to wrap command invocations in try-catch blocks:

```typescript
try {
  const result = await invoke('command_name', parameters);
  // Handle success
} catch (error) {
  console.error('Command failed:', error);
  // Handle error
}
```

Common error types:

- **Database errors**: Connection issues, constraint violations
- **Validation errors**: Invalid input parameters
- **Not found errors**: Requested resource doesn't exist
- **Permission errors**: Insufficient permissions for operation
