import React, { useState, useEffect, useMemo } from 'react';
import { Task, Priority, TaskStatus, CreateTaskRequest } from '../../types';
import { generateId } from '../../utils';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  Select,
  SelectItem,
  Chip,
} from "@heroui/react";
import { 
  Calendar, 
  Hash, 
  Plus,
  Save,
  Target,
  AlertCircle,
  CheckCircle2,
  Flame,
  Timer,
  Edit3,
  PlusCircle
} from 'lucide-react';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTask?: (task: Task) => void;
  onUpdateTask?: (updatedTask: Partial<Task>) => void;
  task?: Task | null; // If provided, we're editing; if null/undefined, we're creating
  defaultDate?: Date;
  className?: string;
}

interface FormData {
  title: string;
  description: string;
  priority: Priority;
  timeEstimate: number;
  dueDate?: Date;
  scheduledDate?: Date;
  tags: string[];
}

export function TaskModal({
  isOpen,
  onClose,
  onCreateTask,
  onUpdateTask,
  task,
  defaultDate,
}: TaskModalProps) {
  const isEditMode = !!task;
  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    priority: Priority.MEDIUM,
    timeEstimate: 60,
    dueDate: defaultDate,
    scheduledDate: defaultDate,
    tags: [],
  });
  const [newTag, setNewTag] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form data when modal opens or task changes
  useEffect(() => {
    if (isOpen) {
      if (isEditMode && task) {
        setFormData({
          title: task.title,
          description: task.description || '',
          priority: task.priority,
          timeEstimate: task.timeEstimate || 60,
          dueDate: task.dueDate,
          scheduledDate: task.scheduledDate,
          tags: task.tags || [],
        });
      } else {
        // Creating new task
        setFormData({
          title: '',
          description: '',
          priority: Priority.MEDIUM,
          timeEstimate: 60,
          dueDate: defaultDate,
          scheduledDate: defaultDate,
          tags: [],
        });
      }
      setNewTag('');
    }
  }, [isOpen, task, isEditMode, defaultDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) return;

    setIsSubmitting(true);

    try {
      if (isEditMode && onUpdateTask) {
        // Edit existing task
        const updatedFields: Partial<Task> = {
          title: formData.title.trim(),
          description: formData.description || '',
          priority: formData.priority,
          timeEstimate: formData.timeEstimate,
          dueDate: formData.dueDate,
          scheduledDate: formData.scheduledDate,
          tags: formData.tags,
          updatedAt: new Date(),
        };
        
        onUpdateTask(updatedFields);
      } else if (onCreateTask) {
        // Create new task
        const newTask: Task = {
          id: generateId(),
          title: formData.title.trim(),
          description: formData.description || '',
          status: TaskStatus.PENDING,
          priority: formData.priority,
          timeEstimate: formData.timeEstimate,
          actualTime: 0,
          dependencies: [],
          subtasks: [],
          dueDate: formData.dueDate,
          scheduledDate: formData.scheduledDate,
          tags: formData.tags,
          completedAt: undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        

        
        onCreateTask(newTask);
      }

      handleClose();
    } catch (error) {
      console.error('Failed to save task:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsSubmitting(false);
    onClose();
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const priorityOptions = [
    { 
      key: Priority.LOW, 
      label: 'Low', 
      icon: <CheckCircle2 className="w-3 h-3" />
    },
    { 
      key: Priority.MEDIUM, 
      label: 'Medium', 
      icon: <Target className="w-3 h-3" />
    },
    { 
      key: Priority.HIGH, 
      label: 'High', 
      icon: <AlertCircle className="w-3 h-3" />
    },
    { 
      key: Priority.URGENT, 
      label: 'Urgent', 
      icon: <Flame className="w-3 h-3" />
    },
  ];

  const selectedPriority = priorityOptions.find(p => p.key === formData.priority);

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose}
      size="lg"
      scrollBehavior="inside"
      backdrop="blur"
    >
      <ModalContent>
        <form onSubmit={handleSubmit}>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              {isEditMode ? (
                <Edit3 className="w-4 h-4" />
              ) : (
                <PlusCircle className="w-4 h-4" />
              )}
              <h2 className="text-lg font-semibold">
                {isEditMode ? 'Edit Task' : 'Create New Task'}
              </h2>
            </div>
          </ModalHeader>
          
          <ModalBody className="gap-4">
            {/* Title */}
            <Input
              autoFocus
              label="Title"
              placeholder="What needs to be done?"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              isRequired
              size="sm"
            />

            {/* Description */}
            <Textarea
              label="Description"
              placeholder="Add details about this task..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              size="sm"
              minRows={2}
              maxRows={4}
            />

            {/* Priority & Time Row */}
            <div className="grid grid-cols-2 gap-3">
              {/* Priority */}
              <Select
                label="Priority"
                placeholder="Select priority"
                selectedKeys={[formData.priority.toString()]}
                onSelectionChange={(keys) => {
                  const priority = Array.from(keys)[0] as string;
                  setFormData(prev => ({ ...prev, priority: parseInt(priority) as Priority }));
                }}
                size="sm"
                renderValue={() => selectedPriority && (
                  <div className="flex items-center gap-2">
                    {selectedPriority.icon}
                    <span>{selectedPriority.label}</span>
                  </div>
                )}
              >
                {priorityOptions.map((priority) => (
                  <SelectItem 
                    key={priority.key}
                    startContent={priority.icon}
                  >
                    {priority.label}
                  </SelectItem>
                ))}
              </Select>

              {/* Time Estimate */}
              <Input
                type="number"
                label="Time (min)"
                placeholder="60"
                value={formData.timeEstimate.toString()}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  timeEstimate: parseInt(e.target.value) || 60 
                }))}
                min={15}
                step={15}
                startContent={<Timer className="w-3 h-3" />}
              />
            </div>

            {/* Dates Row */}
            <div className="grid grid-cols-2 gap-3">
              {/* Due Date */}
              <Input
                type="date"
                label="Due Date"
                value={formData.dueDate ? formData.dueDate.toISOString().split('T')[0] : ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  dueDate: e.target.value ? new Date(e.target.value) : undefined 
                }))}
                size="sm"
                startContent={<Calendar className="w-3 h-3" />}
              />

              {/* Scheduled Date */}
              <Input
                type="date"
                label="Scheduled"
                value={formData.scheduledDate ? formData.scheduledDate.toISOString().split('T')[0] : ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  scheduledDate: e.target.value ? new Date(e.target.value) : undefined 
                }))}
                size="sm"
                startContent={<Calendar className="w-3 h-3" />}
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Add tag..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  size="sm"
                  startContent={<Hash className="w-3 h-3" />}
                  className="flex-1"
                />
                <Button
                  type="button"
                  onPress={addTag}
                  color="primary"
                  variant="flat"
                  size="sm"
                  isIconOnly
                  isDisabled={!newTag.trim() || formData.tags.includes(newTag.trim())}
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {formData.tags.map((tag, index) => (
                    <Chip
                      key={index}
                      onClose={() => removeTag(tag)}
                      variant="flat"
                      color="primary"
                      size="sm"
                    >
                      {tag}
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          </ModalBody>

          <ModalFooter>
            <Button 
              color="danger" 
              variant="light" 
              onPress={handleClose}
              size="sm"
              isDisabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              color="primary" 
              type="submit"
              isDisabled={!formData.title.trim() || isSubmitting}
              isLoading={isSubmitting}
              size="sm"
              startContent={!isSubmitting && (isEditMode ? <Save className="w-3 h-3" /> : <Plus className="w-3 h-3" />)}
            >
              {isEditMode ? 'Save Changes' : 'Create Task'}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
} 