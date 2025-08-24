# Code Example Validation Report

_Generated on: 2025-08-24T14:14:12.238Z_

## Summary

- **Total Examples**: 103
- **Valid Examples**: 0
- **Invalid Examples**: 103
- **Success Rate**: 0.0%

## Validation Errors

The following code examples have validation errors that need to be fixed:

| File                                                      | Line | Language   | Error                                        | Code Preview                                    |
| --------------------------------------------------------- | ---- | ---------- | -------------------------------------------- | ----------------------------------------------- |
| api/integration-examples.md                               | 9    | typescript | host.getDefaultLibFileName is not a function | `import { invoke } from '@tauri-apps/api/core'; |
| import { Task, CreateTaskRequest, Priority, TaskStatu...` |
| api/integration-examples.md                               | 94   | typescript | host.getDefaultLibFileName is not a function | `/\*\*                                          |

- Manage task dependencies with proper validation
  \*/
  class TaskDependencyManager {
  async add...`|
| api/integration-examples.md | 145 | typescript | host.getDefaultLibFileName is not a function |`import { TimerSession, CreateTimeSessionRequest } from '../types';

class TimeTracker {
private ac...`|
| api/integration-examples.md | 232 | typescript | host.getDefaultLibFileName is not a function |`import { CreateAiInteractionRequest, AISuggestion } from '../types';

class AIAssistant {
/\*\*
\*...`|
| api/integration-examples.md | 298 | typescript | host.getDefaultLibFileName is not a function |`import { DatabaseHealth } from '../types';

class DatabaseManager {
/\*\*

- Check database health...`|
| api/integration-examples.md | 359 | typescript | host.getDefaultLibFileName is not a function |`/\*\*
- Centralized error handling for API calls
  \*/
  class APIErrorHandler {
  static async handleAPI...`|
| api/integration-examples.md | 416 | typescript | host.getDefaultLibFileName is not a function |`/\*\*
- Batch operations for better performance
  \*/
  class BatchOperations {
  /\*\*
  - Create multipl...`|
| api/integration-examples.md | 466 | typescript | host.getDefaultLibFileName is not a function |`import { jest } from '@jest/globals';

describe('Task API Integration', () => {
// Mock the invoke...`|
| api/tauri-commands.md | 22 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

// Example command invocation
const result = await i...`|
| api/tauri-commands.md | 46 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('create_ai_interaction',...`|
| api/tauri-commands.md | 71 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_ai_interaction', {
...`|
| api/tauri-commands.md | 95 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_all_ai_interactions...`|
| api/tauri-commands.md | 120 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_ai_interactions_bet...`|
| api/tauri-commands.md | 144 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('search_ai_interactions'...`|
| api/tauri-commands.md | 168 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('update_ai_interaction',...`|
| api/tauri-commands.md | 194 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('delete_ai_interaction',...`|
| api/tauri-commands.md | 215 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_ai_stats', {});
con...`|
| api/tauri-commands.md | 236 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_recent_ai_interacti...`|
| api/tauri-commands.md | 259 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('clear_old_ai_interactio...`|
| api/tauri-commands.md | 282 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_conversation_histor...`|
| api/tauri-commands.md | 307 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('validate_backup_file', ...`|
| api/tauri-commands.md | 330 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('validate_backup_compreh...`|
| api/tauri-commands.md | 353 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('init_database', {});
co...`|
| api/tauri-commands.md | 372 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_database_health', {...`|
| api/tauri-commands.md | 391 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_migration_status_cm...`|
| api/tauri-commands.md | 410 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('test_migration_compatib...`|
| api/tauri-commands.md | 429 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('run_post_migration_init...`|
| api/tauri-commands.md | 448 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('validate_database_integ...`|
| api/tauri-commands.md | 471 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('create_task', {
reque...`|
| api/tauri-commands.md | 496 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_task', {
id: "exa...`|
| api/tauri-commands.md | 519 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_task_with_dependenc...`|
| api/tauri-commands.md | 543 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_all_tasks', {
sta...`|
| api/tauri-commands.md | 568 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_scheduled_tasks', {...`|
| api/tauri-commands.md | 590 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_backlog_tasks', {})...`|
| api/tauri-commands.md | 612 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('update_task', {
id: "...`|
| api/tauri-commands.md | 638 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('delete_task', {
id: "...`|
| api/tauri-commands.md | 662 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('add_task_dependency', {...`|
| api/tauri-commands.md | 687 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('remove_task_dependency'...`|
| api/tauri-commands.md | 711 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_task_dependencies',...`|
| api/tauri-commands.md | 734 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_task_dependents', {...`|
| api/tauri-commands.md | 755 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_task_stats', {});
c...`|
| api/tauri-commands.md | 776 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('search_tasks', {
quer...`|
| api/tauri-commands.md | 799 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_task_sessions', {
...`|
| api/tauri-commands.md | 822 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_task_total_time', {...`|
| api/tauri-commands.md | 846 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_sessions_with_tasks...`|
| api/tauri-commands.md | 868 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('clear_all_data', {});
c...`|
| api/tauri-commands.md | 887 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_all_task_lists', {}...`|
| api/tauri-commands.md | 908 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('create_task_list', {
...`|
| api/tauri-commands.md | 934 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('update_task_list', {
...`|
| api/tauri-commands.md | 960 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('delete_task_list', {
...`|
| api/tauri-commands.md | 981 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_default_task_list',...`|
| api/tauri-commands.md | 1003 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('move_task_to_list', {
...`|
| api/tauri-commands.md | 1027 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_tasks_by_task_list'...`|
| api/tauri-commands.md | 1048 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_task_list_stats', {...`|
| api/tauri-commands.md | 1071 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('create_time_session', {...`|
| api/tauri-commands.md | 1096 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_time_session', {
...`|
| api/tauri-commands.md | 1119 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_active_session', {
...`|
| api/tauri-commands.md | 1140 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_any_active_session'...`|
| api/tauri-commands.md | 1162 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_sessions_between', ...`|
| api/tauri-commands.md | 1187 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('update_time_session', {...`|
| api/tauri-commands.md | 1214 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('stop_time_session', {
...`|
| api/tauri-commands.md | 1238 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('pause_time_session', {
...`|
| api/tauri-commands.md | 1261 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('resume_time_session', {...`|
| api/tauri-commands.md | 1284 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('delete_time_session', {...`|
| api/tauri-commands.md | 1308 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_time_stats', {
st...`|
| api/tauri-commands.md | 1332 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('get_recent_sessions', {...`|
| api/tauri-commands.md | 1357 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('greet', {
name: "exam...`|
| api/tauri-commands.md | 1380 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('export_data_to_file', {...`|
| api/tauri-commands.md | 1404 | typescript | host.getDefaultLibFileName is not a function |`import { invoke } from '@tauri-apps/api/core';

const result = await invoke('import_data_from_file',...`|
| api/tauri-commands.md | 1759 | typescript | host.getDefaultLibFileName is not a function |`try {
const result = await invoke('command_name', parameters);
// Handle success
} catch (error)...`|
| api/typescript-interfaces.md | 21 | typescript | host.getDefaultLibFileName is not a function |`enum Priority {
LOW = 0,
MEDIUM = 1,
HIGH = 2,
URGENT = 3,
}
...`|
| api/typescript-interfaces.md | 32 | typescript | host.getDefaultLibFileName is not a function |`enum TaskStatus {
PENDING = 'pending',
IN_PROGRESS = 'in_progress',
COMPLETED = 'completed',
...`|
| api/typescript-interfaces.md | 43 | typescript | host.getDefaultLibFileName is not a function |`enum FocusLevel {
LOW = 'low',
MEDIUM = 'medium',
HIGH = 'high',
DEEP = 'deep',
}
...`|
| api/typescript-interfaces.md | 54 | typescript | host.getDefaultLibFileName is not a function |`enum DistractionLevel {
NONE = 'none',
MINIMAL = 'minimal',
MODERATE = 'moderate',
FULL = 'f...`|
| api/typescript-interfaces.md | 67 | typescript | host.getDefaultLibFileName is not a function |`interface TrendData {
timestamp: Date;
value: number;
type: 'energy' | 'focus' | 'productivity...`|
| api/typescript-interfaces.md | 77 | typescript | host.getDefaultLibFileName is not a function |`interface TimeSlot {
start: string;
end: string;
dayOfWeek: number;
}
...`|
| api/typescript-interfaces.md | 87 | typescript | host.getDefaultLibFileName is not a function |`interface WeeklyPlan {
id: string;
weekStart: Date;
tasks: PlannedTask[];
goals: WeeklyGoal[...`|
| api/typescript-interfaces.md | 103 | typescript | host.getDefaultLibFileName is not a function |`interface WeeklyGoal {
id: string;
title: string;
description: string;
targetValue: number;
...`|
| api/typescript-interfaces.md | 117 | typescript | host.getDefaultLibFileName is not a function |`interface AppContext {
currentTask?: Task;
activeSession?: TimerSession;
activeFocusSession?: ...`|
| api/typescript-interfaces.md | 134 | typescript | host.getDefaultLibFileName is not a function |`interface ActivityEvent {
id: string;
type: | 'task_created'
| 'task_completed'
| 'timer...`|
| api/typescript-interfaces.md | 150 | typescript | host.getDefaultLibFileName is not a function |`interface UserPreferences {
workingHours: {
start: string; // HH:MM
end: string; // HH:MM
...`|
| api/typescript-interfaces.md | 195 | typescript | host.getDefaultLibFileName is not a function |`interface ValidationResult {
isValid: boolean;
errors: string[];
warnings: string[];
}
...`|
| api/typescript-interfaces.md | 207 | typescript | host.getDefaultLibFileName is not a function |`interface Task {
id: string;
title: string;
description: string;
priority: Priority;
statu...`|
| api/typescript-interfaces.md | 232 | typescript | host.getDefaultLibFileName is not a function |`interface TaskList {
id: string;
name: string;
isDefault: boolean;
createdAt: Date;
update...`|
| api/typescript-interfaces.md | 244 | typescript | host.getDefaultLibFileName is not a function |`interface TaskListSelection {
type: 'all' | 'specific';
taskListId?: string;
taskList?: TaskLi...`|
| api/typescript-interfaces.md | 254 | typescript | host.getDefaultLibFileName is not a function |`interface TaskListService {
}
...`|
| api/typescript-interfaces.md | 261 | typescript | host.getDefaultLibFileName is not a function |`interface PlannedTask {
taskId: string;
scheduledStart: Date;
scheduledEnd: Date;
actualStar...`|
| api/typescript-interfaces.md | 274 | typescript | host.getDefaultLibFileName is not a function |`interface TaskFilters {
status?: TaskStatus[];
priority?: Priority[];
tags?: string[];
dueDa...`|
| api/typescript-interfaces.md | 291 | typescript | host.getDefaultLibFileName is not a function |`interface TaskSortOptions {
field: 'title' | 'priority' | 'dueDate' | 'createdAt' | 'updatedAt';
...`|
| api/typescript-interfaces.md | 302 | typescript | host.getDefaultLibFileName is not a function |`interface TimerSession {
id: string;
taskId: string;
startTime: Date;
endTime?: Date;
paus...`|
| api/typescript-interfaces.md | 318 | typescript | host.getDefaultLibFileName is not a function |`interface TimerBreak {
id: string;
startTime: Date;
endTime: Date;
reason: string;
}
...`|
| api/typescript-interfaces.md | 329 | typescript | host.getDefaultLibFileName is not a function |`interface CompletedSession {
id: string;
taskId: string;
duration: number;
actualWork: numbe...`|
| api/typescript-interfaces.md | 344 | typescript | host.getDefaultLibFileName is not a function |`interface FocusSession {
id: string;
taskId: string;
plannedDuration: number;
actualDuration...`|
| api/typescript-interfaces.md | 364 | typescript | host.getDefaultLibFileName is not a function |`interface TaskTimerProps {
onTimerStart: () => void;
onTimerPause: () => void;
onTimerStop: ()...`|
| api/typescript-interfaces.md | 377 | typescript | host.getDefaultLibFileName is not a function |`interface SessionStatistics {
totalSessions: number;
totalTime: number;
totalWorkTime: number;...`|
| api/typescript-interfaces.md | 394 | typescript | host.getDefaultLibFileName is not a function |`interface AISuggestion {
id: string;
type: 'task' | 'schedule' | 'break' | 'focus' | 'energy' | ...`|
| api/typescript-interfaces.md | 414 | typescript | host.getDefaultLibFileName is not a function |`interface AIAction {
type: | 'CREATE_TASK'
| 'UPDATE_TASK'
| 'START_TIMER'
| 'STOP_TIM...`|
| api/typescript-interfaces.md | 435 | typescript | host.getDefaultLibFileName is not a function |`interface FocusConfig {
duration: number;
taskId: string;
distractionLevel: DistractionLevel;
...`|
| api/typescript-interfaces.md | 448 | typescript | host.getDefaultLibFileName is not a function |`interface AudioConfig {
type: 'white_noise' | 'nature' | 'music' | 'silence';
volume: number;
...`|
| api/typescript-interfaces.md | 462 | typescript | host.getDefaultLibFileName is not a function |`const TASK_LIST_ALL: inferred = '**ALL**';
...`|
| api/typescript-interfaces.md | 468 | typescript | host.getDefaultLibFileName is not a function |`const TASK_LIST_DEFAULT: inferred = '**DEFAULT**';
...`|
| developer/architecture.md | 85 | typescript | host.getDefaultLibFileName is not a function |`// Context structure
TaskListContext; // Task and list management
TimerContext; // Time tracking sta...`|
| developer/architecture.md | 115 | typescript | host.getDefaultLibFileName is not a function |`interface TaskRepository {
create(task: CreateTaskInput): Promise<Task>;
findById(id: string): P...` |

## Validation Rules

The following rules are applied to code examples:

### TypeScript/JavaScript

- Syntax must be valid
- No use of `any` type (prefer specific types)
- Proper error handling for async operations
- Correct imports for used functions

### Tauri Commands

- Command names must exist in the backend
- Proper parameter structure
- Correct return type handling

### Best Practices

- Use `await` with async functions
- Include type annotations where helpful
- Remove debug statements like `console.log`
- Include proper error handling

## Fixing Validation Errors

To fix validation errors:

1. **Syntax Errors**: Check for missing brackets, semicolons, or typos
2. **Unknown Commands**: Verify command names against the Tauri API reference
3. **Type Errors**: Add proper type annotations and imports
4. **Missing Imports**: Add required import statements
5. **Error Handling**: Wrap async calls in try-catch blocks

## Automated Validation

This validation runs automatically when generating API documentation. To run manually:

```bash
npm run docs:validate
```
