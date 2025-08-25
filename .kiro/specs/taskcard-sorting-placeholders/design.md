# Design Document

## Overview

The taskcard sorting placeholders feature enhances the existing @dnd-kit drag-and-drop system by adding visual feedback when reordering tasks within columns. The design leverages @dnd-kit's built-in collision detection and drag overlay systems to create smooth, responsive placeholder lines that indicate precise drop positions. This feature integrates seamlessly with the existing TaskCard, TaskColumn, WeekView, and DayView components without breaking current functionality.

## Architecture

### Core Components Integration

The design builds upon the existing drag-and-drop architecture:

- **@dnd-kit/core**: Provides DndContext, collision detection, and drag events
- **@dnd-kit/sortable**: Handles SortableContext and useSortable hooks
- **TaskCard**: Already implements useSortable with drag handles
- **TaskColumn**: Contains SortableContext and drop zones
- **WeekView/DayView**: Manage DndContext and drag event handlers

### New Components

#### DropPlaceholder Component

A new reusable component that renders the green line placeholder with animations.

#### Enhanced Collision Detection

Custom collision detection logic that determines placeholder positions based on mouse/pointer position relative to task cards.

#### Placeholder State Management

State management system to track placeholder visibility, position, and animations across drag operations.

## Components and Interfaces

### DropPlaceholder Component

```typescript
interface DropPlaceholderProps {
  isVisible: boolean;
  position: 'above' | 'below';
  taskId: string;
  columnId: string;
  animationDuration?: number;
}

export function DropPlaceholder({
  isVisible,
  position,
  taskId,
  columnId,
  animationDuration = 200,
}: DropPlaceholderProps) {
  // Renders animated green line with smooth transitions
}
```

### Enhanced TaskColumn Interface

```typescript
interface TaskColumnProps {
  // ... existing props
  draggedTaskId?: string | null;
  placeholderPosition?: PlaceholderPosition | null;
  onPlaceholderChange?: (position: PlaceholderPosition | null) => void;
}

interface PlaceholderPosition {
  taskId: string;
  position: 'above' | 'below';
  columnId: string;
}
```

### Custom Collision Detection

```typescript
interface PlaceholderCollisionDetection {
  detectPlaceholderPosition(
    draggedElement: Element,
    droppableElements: Element[],
    pointerCoordinates: { x: number; y: number }
  ): PlaceholderPosition | null;
}
```

## Data Models

### Placeholder State

```typescript
interface PlaceholderState {
  isVisible: boolean;
  position: PlaceholderPosition | null;
  animating: boolean;
  lastUpdate: number;
}

interface DragState {
  draggedTaskId: string | null;
  draggedFromColumn: string | null;
  currentColumn: string | null;
  placeholder: PlaceholderState;
}
```

### Animation Configuration

```typescript
interface PlaceholderAnimationConfig {
  duration: number; // 150-200ms
  easing: string; // 'ease-out'
  fadeInDelay: number; // 100ms
  fadeOutDelay: number; // 50ms
}
```

## Implementation Strategy

### Phase 1: Core Placeholder Component

1. **Create DropPlaceholder Component**
   - Implement green line with proper styling (#10B981 color)
   - Add smooth fade-in/fade-out animations
   - Support positioning above/below target tasks
   - Ensure responsive width based on container

2. **Enhance TaskColumn Component**
   - Add placeholder state management
   - Integrate DropPlaceholder components between tasks
   - Handle placeholder visibility based on drag state

### Phase 2: Collision Detection Enhancement

1. **Custom Collision Algorithm**
   - Calculate pointer position relative to task elements
   - Determine closest drop position (above/below tasks)
   - Handle edge cases (first task, last task, empty column)
   - Optimize for performance with many tasks

2. **Integration with @dnd-kit**
   - Extend existing collision detection without breaking current functionality
   - Use onDragOver events to update placeholder positions
   - Maintain compatibility with column-to-column drag operations

### Phase 3: State Management Integration

1. **Enhanced Drag Handlers**
   - Update WeekView and DayView drag event handlers
   - Add placeholder state to existing drag state management
   - Ensure smooth transitions between placeholder positions

2. **Performance Optimization**
   - Debounce placeholder position calculations
   - Use React.memo for DropPlaceholder components
   - Implement efficient re-rendering strategies

## Error Handling

### Drag Operation Failures

- **Invalid drop positions**: Gracefully handle edge cases where placeholder calculation fails
- **Animation interruptions**: Ensure placeholder state is reset if drag operations are cancelled
- **Performance degradation**: Implement fallback behavior for low-performance devices

### State Consistency

- **Placeholder cleanup**: Ensure placeholders are hidden when drag operations end
- **Multiple drag operations**: Handle rapid successive drag operations without state conflicts
- **Component unmounting**: Clean up placeholder state when components unmount

## Testing Strategy

### Unit Tests

#### DropPlaceholder Component

- Render with different visibility states
- Animation timing and transitions
- Responsive width calculations
- Accessibility attributes

#### Collision Detection

- Placeholder position calculations
- Edge case handling (empty columns, single tasks)
- Performance with large task lists
- Pointer coordinate accuracy

### Integration Tests

#### TaskColumn Integration

- Placeholder positioning within columns
- State updates during drag operations
- Interaction with existing SortableContext

#### WeekView/DayView Integration

- Cross-column drag behavior
- Placeholder hiding when dragging between columns
- State management across multiple columns

### End-to-End Tests

#### Complete Drag-and-Drop Workflow

- Task reordering with visual feedback
- Placeholder accuracy during complex drag operations
- Performance under various task loads
- Keyboard accessibility

## Performance Considerations

### Rendering Optimization

- **Virtual placeholders**: Only render placeholders for visible tasks
- **Memoization**: Use React.memo for DropPlaceholder components
- **Efficient updates**: Minimize re-renders during drag operations

### Calculation Efficiency

- **Debounced updates**: Limit placeholder position calculations to 60fps
- **Spatial indexing**: Use efficient algorithms for collision detection
- **Memory management**: Clean up event listeners and state on component unmount

### Animation Performance

- **CSS transforms**: Use transform properties for smooth animations
- **Hardware acceleration**: Leverage GPU acceleration for placeholder animations
- **Reduced motion**: Respect user preferences for reduced motion

## Accessibility Considerations

### Visual Accessibility

- **Color contrast**: Ensure green placeholder line meets WCAG contrast requirements
- **Alternative indicators**: Provide non-color-based visual cues
- **Reduced motion**: Implement alternative feedback for users with motion sensitivity

### Keyboard Navigation

- **Screen reader support**: Announce placeholder positions during keyboard drag
- **Focus management**: Maintain proper focus during keyboard-based reordering
- **Alternative interactions**: Provide keyboard shortcuts for task reordering

### Assistive Technology

- **ARIA labels**: Add appropriate ARIA attributes to placeholder elements
- **Live regions**: Use ARIA live regions to announce drag state changes
- **Semantic markup**: Ensure placeholder elements have proper semantic meaning

## Browser Compatibility

### Modern Browser Support

- **CSS Grid/Flexbox**: Leverage modern layout systems for placeholder positioning
- **CSS Custom Properties**: Use CSS variables for theming and animation timing
- **Intersection Observer**: Use for efficient visibility detection

### Fallback Strategies

- **Legacy browser support**: Provide graceful degradation for older browsers
- **Touch device optimization**: Ensure smooth performance on mobile devices
- **Reduced functionality**: Maintain core drag-and-drop without placeholders if needed

## Integration Points

### Existing Drag-and-Drop System

- **Preserve current behavior**: Maintain all existing drag-and-drop functionality
- **Column-to-column drags**: Keep existing column drop indicators
- **Task ordering**: Use existing onInlineEdit callback for order updates

### Theme System

- **Color integration**: Use existing theme colors with green accent for placeholders
- **Dark mode support**: Ensure placeholder visibility in both light and dark themes
- **Custom themes**: Allow placeholder styling to adapt to custom theme configurations

### Animation System

- **Framer Motion integration**: Leverage existing Framer Motion setup for animations
- **Consistent timing**: Use animation timing consistent with existing UI transitions
- **Performance monitoring**: Integrate with existing performance monitoring systems
