# Contributing

We welcome contributions to KiraPilot! This guide will help you get started with contributing to the project.

## Getting Started

### Prerequisites

Before contributing, make sure you have:

1. **Development environment set up** - Follow the [Development Setup](./setup.md) guide
2. **Familiarity with the codebase** - Review the [Architecture](./architecture.md) and [Project Structure](./project-structure.md)
3. **GitHub account** - For submitting pull requests and issues

### Ways to Contribute

#### Code Contributions

- **Bug fixes**: Fix issues reported in GitHub Issues
- **New features**: Implement features from the roadmap
- **Performance improvements**: Optimize existing functionality
- **Tests**: Add or improve test coverage
- **Documentation**: Update or expand documentation

#### Non-Code Contributions

- **Bug reports**: Report issues you encounter
- **Feature requests**: Suggest new functionality
- **Documentation**: Improve guides and API docs
- **Translations**: Help localize KiraPilot
- **Community support**: Help other users in discussions

### Finding Issues to Work On

1. **Check GitHub Issues** labeled with:
   - `good first issue` - Great for new contributors
   - `help wanted` - Community contributions welcome
   - `bug` - Bug fixes needed
   - `enhancement` - New features or improvements

2. **Review the project roadmap** for planned features
3. **Ask in discussions** if you're unsure what to work on

## Development Workflow

### Setting Up Your Fork

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/kirapilot-app.git
   cd kirapilot-app
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/vietanhdev/kirapilot-app.git
   ```
4. **Install dependencies**:
   ```bash
   npm install
   ```

### Creating a Feature Branch

1. **Sync with upstream**:
   ```bash
   git checkout main
   git pull upstream main
   ```
2. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```

### Making Changes

1. **Make your changes** following the code style guidelines
2. **Write or update tests** for your changes
3. **Run the test suite**:
   ```bash
   npm test
   ```
4. **Check code quality**:
   ```bash
   npm run lint
   npm run type-check
   npm run format:check
   ```
5. **Test your changes** thoroughly in the application

### Committing Changes

We use conventional commits for clear commit messages:

#### Commit Message Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

#### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc.)
- **refactor**: Code refactoring
- **test**: Adding or updating tests
- **chore**: Maintenance tasks

#### Examples

```bash
git commit -m "feat(tasks): add time preset options for task creation"
git commit -m "fix(timer): resolve timer not stopping on task completion"
git commit -m "docs(api): update TypeScript interfaces documentation"
git commit -m "test(database): add integration tests for task repository"
```

## Code Style and Standards

### TypeScript Guidelines

#### Type Safety

- **Use strict TypeScript**: No `any` types unless absolutely necessary
- **Define interfaces**: Create proper interfaces for all data structures
- **Use enums**: For fixed sets of values
- **Prefer type unions**: Over loose typing

```typescript
// Good
interface Task {
  id: string;
  title: string;
  priority: Priority;
  status: TaskStatus;
}

// Avoid
interface Task {
  id: any;
  title: string;
  priority: number;
  status: string;
}
```

#### Naming Conventions

- **Interfaces**: PascalCase (`Task`, `UserPreferences`)
- **Types**: PascalCase (`TaskStatus`, `Priority`)
- **Functions**: camelCase (`createTask`, `updateTimer`)
- **Variables**: camelCase (`taskList`, `currentUser`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_PRIORITY`, `MAX_RETRIES`)
- **Files**: camelCase for utilities, PascalCase for components

### React Guidelines

#### Component Structure

```typescript
// Component file structure
import { useState, useEffect } from 'react';
import { Button } from '@heroui/react';

import { Task, TaskStatus } from '../types';
import { useDatabase } from '../hooks/useDatabase';
import { TaskCard } from './TaskCard';

interface TaskListProps {
  tasks: Task[];
  onTaskUpdate: (task: Task) => void;
}

export function TaskList({ tasks, onTaskUpdate }: TaskListProps) {
  // Component implementation
}
```

#### Hooks Usage

- **Use custom hooks** for reusable logic
- **Follow hooks rules** (only call at top level)
- **Prefer useCallback** for event handlers
- **Use useMemo** for expensive calculations

```typescript
// Good
const handleTaskUpdate = useCallback(
  (task: Task) => {
    onTaskUpdate(task);
  },
  [onTaskUpdate]
);

const sortedTasks = useMemo(() => {
  return tasks.sort((a, b) => a.priority - b.priority);
}, [tasks]);
```

### Rust Guidelines

#### Code Style

- **Follow rustfmt**: Use `cargo fmt` for formatting
- **Use clippy**: Address all clippy warnings
- **Error handling**: Use `Result` types, avoid panics
- **Documentation**: Add doc comments for public APIs

```rust
/// Creates a new task in the database
///
/// # Arguments
/// * `task_data` - The task creation data
///
/// # Returns
/// * `Result<Task, DbErr>` - The created task or database error
pub async fn create_task(&self, task_data: CreateTaskInput) -> Result<Task, DbErr> {
    // Implementation
}
```

#### Database Operations

- **Use transactions** for multi-step operations
- **Handle errors gracefully** with proper error types
- **Validate input** before database operations
- **Use prepared statements** to prevent SQL injection

### Testing Standards

#### Test Organization

```
src/
├── components/
│   └── __tests__/
│       └── TaskCard.test.tsx
├── hooks/
│   └── __tests__/
│       └── useDatabase.test.ts
└── __tests__/
    ├── setup/
    ├── mocks/
    └── integration/
```

#### Test Naming

```typescript
describe('TaskCard', () => {
  describe('when task is completed', () => {
    it('should display completion checkmark', () => {
      // Test implementation
    });
  });

  describe('when task has high priority', () => {
    it('should display red priority indicator', () => {
      // Test implementation
    });
  });
});
```

#### Test Coverage

- **Aim for 80%+ coverage** on new code
- **Test edge cases** and error conditions
- **Mock external dependencies** appropriately
- **Use integration tests** for critical workflows

### Documentation Standards

#### Code Documentation

- **JSDoc comments** for all public functions
- **Type annotations** for complex types
- **README files** in major directories
- **Inline comments** for complex logic

```typescript
/**
 * Calculates the estimated completion time for a task based on historical data
 *
 * @param task - The task to estimate
 * @param historicalData - Previous task completion data
 * @returns Estimated completion time in minutes
 */
function estimateTaskTime(
  task: Task,
  historicalData: CompletedSession[]
): number {
  // Implementation with inline comments for complex logic
}
```

#### API Documentation

- **Keep TypeScript interfaces updated** in `docs/docs/api/`
- **Document breaking changes** in pull requests
- **Update user guides** when adding user-facing features
- **Include examples** in documentation

## Pull Request Process

### Before Submitting

1. **Ensure all tests pass**:

   ```bash
   npm run build:all
   ```

2. **Update documentation** if needed

3. **Add changelog entry** for significant changes

4. **Rebase on latest main**:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

### Pull Request Template

When creating a pull request, include:

#### Description

- **What**: Brief description of changes
- **Why**: Reason for the changes
- **How**: Approach taken

#### Testing

- **Test coverage**: What tests were added/updated
- **Manual testing**: How you verified the changes
- **Edge cases**: Any edge cases considered

#### Screenshots

- **Before/after**: For UI changes
- **New features**: Screenshots of new functionality

#### Checklist

- [ ] Tests pass locally
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
- [ ] Changelog updated (if applicable)

### Review Process

1. **Automated checks** must pass (CI/CD pipeline)
2. **Code review** by maintainers
3. **Testing** by reviewers if needed
4. **Approval** from at least one maintainer
5. **Merge** by maintainers

### After Merge

1. **Delete your feature branch**:
   ```bash
   git branch -d feature/your-feature-name
   ```
2. **Sync your fork**:
   ```bash
   git checkout main
   git pull upstream main
   git push origin main
   ```

## Community Guidelines

### Code of Conduct

We are committed to providing a welcoming and inclusive environment:

- **Be respectful** in all interactions
- **Be constructive** in feedback and criticism
- **Be patient** with new contributors
- **Be collaborative** in problem-solving

### Communication

#### GitHub Issues

- **Search existing issues** before creating new ones
- **Use clear, descriptive titles**
- **Provide reproduction steps** for bugs
- **Include system information** when relevant

#### Pull Request Reviews

- **Be specific** in feedback
- **Explain the "why"** behind suggestions
- **Acknowledge good work**
- **Be open to discussion**

#### Discussions

- **Ask questions** if you're unsure
- **Share knowledge** and help others
- **Stay on topic** in discussions
- **Be patient** with response times

### Recognition

Contributors are recognized through:

- **Contributors list** in the README
- **Release notes** mentioning significant contributions
- **GitHub contributor insights**
- **Community highlights** in discussions

## Getting Help

### Resources

- **[Development Setup](./setup.md)** - Environment setup
- **[Architecture Overview](./architecture.md)** - Technical architecture
- **[Project Structure](./project-structure.md)** - Code organization
- **[Database Documentation](./database.md)** - Database schema and operations

### Support Channels

- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - Questions and community support
- **Discord** - Real-time chat with the community
- **Email** - Direct contact with maintainers

### Mentorship

New contributors can get help through:

- **Good first issue** labels for beginner-friendly tasks
- **Mentorship program** pairing new contributors with experienced ones
- **Code review feedback** with learning opportunities
- **Community support** in discussions and Discord

## Release Process

### Versioning

KiraPilot follows semantic versioning (SemVer):

- **Major** (1.0.0): Breaking changes
- **Minor** (0.1.0): New features, backward compatible
- **Patch** (0.0.1): Bug fixes, backward compatible

### Release Cycle

- **Regular releases**: Monthly minor releases
- **Patch releases**: As needed for critical fixes
- **Major releases**: When significant breaking changes accumulate

### Contributing to Releases

- **Test release candidates** and provide feedback
- **Update documentation** for new features
- **Help with release notes** and changelog
- **Assist with migration guides** for breaking changes

Thank you for contributing to KiraPilot! Your contributions help make productivity tools better for everyone.
