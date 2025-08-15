// Tests for TaskCard component
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskCard } from '../TaskCard';
import { Task, TaskStatus, Priority } from '../../../types';

// Mock utility functions
jest.mock('../../../utils', () => ({
    getPriorityColor: jest.fn(() => 'text-red-600 bg-red-50 border-red-200'),
    getStatusColor: jest.fn(() => 'text-blue-600 bg-blue-50 border-blue-200'),
    formatDuration: jest.fn((ms) => `${Math.floor(ms / 60000)}m`),
    formatRelativeTime: jest.fn(() => '2 hours ago'),
}));

const mockTask: Task = {
    id: '1',
    title: 'Test Task',
    description: 'Test Description',
    priority: Priority.HIGH,
    status: TaskStatus.PENDING,
    dependencies: ['2', '3'],
    timeEstimate: 60,
    actualTime: 30,
    dueDate: new Date('2024-12-31'),
    tags: ['work', 'urgent'],
    subtasks: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
};

const mockDependencyTasks: Task[] = [
    {
        id: '2',
        title: 'Dependency Task 1',
        description: 'Completed dependency',
        priority: Priority.MEDIUM,
        status: TaskStatus.COMPLETED,
        dependencies: [],
        timeEstimate: 30,
        actualTime: 30,
        tags: [],
        subtasks: [],
        completedAt: new Date('2024-01-02'),
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
    },
    {
        id: '3',
        title: 'Dependency Task 2',
        description: 'Incomplete dependency',
        priority: Priority.LOW,
        status: TaskStatus.PENDING,
        dependencies: [],
        timeEstimate: 45,
        actualTime: 0,
        tags: [],
        subtasks: [],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
    },
    {
        id: '4',
        title: 'Dependent Task',
        description: 'Task that depends on the main task',
        priority: Priority.HIGH,
        status: TaskStatus.PENDING,
        dependencies: ['1'],
        timeEstimate: 60,
        actualTime: 0,
        tags: [],
        subtasks: [],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
    },
];

describe('TaskCard', () => {
    const defaultProps = {
        task: mockTask,
        onEdit: jest.fn(),
        onDelete: jest.fn(),
        onStatusChange: jest.fn(),
        onStartTimer: jest.fn(),
        allTasks: mockDependencyTasks,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders task information correctly', () => {
        render(<TaskCard {...defaultProps} />);

        expect(screen.getByText('Test Task')).toBeInTheDocument();
        expect(screen.getByText('Test Description')).toBeInTheDocument();
        expect(screen.getByText('60m')).toBeInTheDocument(); // Time estimate
        expect(screen.getByText('30m spent')).toBeInTheDocument(); // Actual time
        expect(screen.getByText('Due 2 hours ago')).toBeInTheDocument();
    });

    it('displays tags correctly', () => {
        render(<TaskCard {...defaultProps} />);

        expect(screen.getByText('work')).toBeInTheDocument();
        expect(screen.getByText('urgent')).toBeInTheDocument();
    });

    it('shows dependency information', () => {
        render(<TaskCard {...defaultProps} />);

        expect(screen.getByText('2 dependencies (1 incomplete)')).toBeInTheDocument();
        expect(screen.getByText('1 tasks depend on this')).toBeInTheDocument();
    });

    it('displays dependency details section', () => {
        render(<TaskCard {...defaultProps} />);

        // Check for dependency section
        expect(screen.getByText('Dependencies:')).toBeInTheDocument();
        expect(screen.getByText('Dependency Task 1')).toBeInTheDocument();
        expect(screen.getByText('Dependency Task 2')).toBeInTheDocument();

        // Check for dependent tasks section
        expect(screen.getByText('Blocks:')).toBeInTheDocument();
        expect(screen.getByText('Dependent Task')).toBeInTheDocument();
    });

    it('shows blocked indicator when task has incomplete dependencies', () => {
        render(<TaskCard {...defaultProps} />);

        expect(screen.getByText('BLOCKED')).toBeInTheDocument();
    });

    it('does not show blocked indicator when all dependencies are complete', () => {
        const taskWithCompletedDeps = {
            ...mockTask,
            dependencies: ['2'], // Only completed dependency
        };

        render(<TaskCard {...defaultProps} task={taskWithCompletedDeps} />);

        expect(screen.queryByText('BLOCKED')).not.toBeInTheDocument();
    });

    it('calls onEdit when edit button is clicked', () => {
        render(<TaskCard {...defaultProps} />);

        const editButton = screen.getByTitle('Edit task');
        fireEvent.click(editButton);

        expect(defaultProps.onEdit).toHaveBeenCalledWith(mockTask);
    });

    it('calls onDelete when delete button is clicked', () => {
        render(<TaskCard {...defaultProps} />);

        const deleteButton = screen.getByTitle('Delete task');
        fireEvent.click(deleteButton);

        expect(defaultProps.onDelete).toHaveBeenCalledWith(mockTask);
    });

    it('calls onStatusChange when status toggle is clicked', () => {
        render(<TaskCard {...defaultProps} />);

        const statusButton = screen.getByTitle('Mark as complete');
        fireEvent.click(statusButton);

        expect(defaultProps.onStatusChange).toHaveBeenCalledWith(mockTask, TaskStatus.COMPLETED);
    });

    it('calls onStartTimer when start timer button is clicked', () => {
        render(<TaskCard {...defaultProps} />);

        const timerButton = screen.getByTitle('Start timer');
        fireEvent.click(timerButton);

        expect(defaultProps.onStartTimer).toHaveBeenCalledWith(mockTask);
    });

    it('shows completed status for completed tasks', () => {
        const completedTask = {
            ...mockTask,
            status: TaskStatus.COMPLETED,
            completedAt: new Date('2024-01-03'),
        };

        render(<TaskCard {...defaultProps} task={completedTask} />);

        expect(screen.getByTitle('Mark as incomplete')).toBeInTheDocument();
    });

    it('shows in progress indicator for active tasks', () => {
        const inProgressTask = {
            ...mockTask,
            status: TaskStatus.IN_PROGRESS,
        };

        render(<TaskCard {...defaultProps} task={inProgressTask} />);

        expect(screen.getByText('In Progress')).toBeInTheDocument();
    });

    it('does not show actions when showActions is false', () => {
        render(<TaskCard {...defaultProps} showActions={false} />);

        expect(screen.queryByTitle('Edit task')).not.toBeInTheDocument();
        expect(screen.queryByTitle('Delete task')).not.toBeInTheDocument();
        expect(screen.queryByTitle('Start timer')).not.toBeInTheDocument();
    });

    it('shows overdue styling for overdue tasks', () => {
        const overdueTask = {
            ...mockTask,
            dueDate: new Date('2020-01-01'), // Past date
        };

        const { container } = render(<TaskCard {...defaultProps} task={overdueTask} />);

        // Check for overdue styling classes
        const taskCard = container.firstChild as HTMLElement;
        expect(taskCard).toHaveClass('border-red-300');
    });

    it('shows blocked styling for blocked tasks', () => {
        const { container } = render(<TaskCard {...defaultProps} />);

        // Check for blocked styling classes
        const taskCard = container.firstChild as HTMLElement;
        expect(taskCard).toHaveClass('border-orange-300');
    });

    it('limits displayed dependent tasks to 3 with overflow indicator', () => {
        const manyDependentTasks = [
            ...mockDependencyTasks,
            {
                id: '5',
                title: 'Dependent Task 2',
                description: 'Another dependent task',
                priority: Priority.MEDIUM,
                status: TaskStatus.PENDING,
                dependencies: ['1'],
                timeEstimate: 30,
                actualTime: 0,
                tags: [],
                subtasks: [],
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-01'),
            },
            {
                id: '6',
                title: 'Dependent Task 3',
                description: 'Yet another dependent task',
                priority: Priority.LOW,
                status: TaskStatus.PENDING,
                dependencies: ['1'],
                timeEstimate: 15,
                actualTime: 0,
                tags: [],
                subtasks: [],
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-01'),
            },
            {
                id: '7',
                title: 'Dependent Task 4',
                description: 'Fourth dependent task',
                priority: Priority.LOW,
                status: TaskStatus.PENDING,
                dependencies: ['1'],
                timeEstimate: 20,
                actualTime: 0,
                tags: [],
                subtasks: [],
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-01'),
            },
            {
                id: '8',
                title: 'Dependent Task 5',
                description: 'Fifth dependent task',
                priority: Priority.LOW,
                status: TaskStatus.PENDING,
                dependencies: ['1'],
                timeEstimate: 25,
                actualTime: 0,
                tags: [],
                subtasks: [],
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-01'),
            },
        ];

        render(<TaskCard {...defaultProps} allTasks={manyDependentTasks} />);

        expect(screen.getByText('+2 more tasks')).toBeInTheDocument();
    });

    it('does not show dependency section when task has no dependencies or dependents', () => {
        const independentTask = {
            ...mockTask,
            dependencies: [],
        };

        const tasksWithoutDependents = mockDependencyTasks.filter(t => !t.dependencies.includes('1'));

        render(<TaskCard {...defaultProps} task={independentTask} allTasks={tasksWithoutDependents} />);

        expect(screen.queryByText('Dependencies:')).not.toBeInTheDocument();
        expect(screen.queryByText('Blocks:')).not.toBeInTheDocument();
    });
});