// Task editing modal using HeroUI components
import { useState, useEffect } from 'react';
import { Task, Priority } from '../../types';
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
  Clock, 
  Hash, 
  Plus,
  Save
} from 'lucide-react';

interface TaskEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdateTask: (updatedTask: Partial<Task>) => void;
  task: Task | null;
  className?: string;
}

export function TaskEditModal({
  isOpen,
  onClose,
  onUpdateTask,
  task
}: TaskEditModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: Priority.MEDIUM,
    timeEstimate: 60,
    dueDate: undefined as Date | undefined,
    scheduledDate: undefined as Date | undefined,
    tags: [] as string[],
  });

  const [newTag, setNewTag] = useState('');

  // Update form data when task changes or modal opens
  useEffect(() => {
    if (isOpen && task) {
      setFormData({
        title: task.title,
        description: task.description || '',
        priority: task.priority,
        timeEstimate: task.timeEstimate || 60,
        dueDate: task.dueDate,
        scheduledDate: task.scheduledDate,
        tags: task.tags || [],
      });
      setNewTag('');
    }
  }, [isOpen, task]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) return;

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
    handleClose();
  };

  const handleClose = () => {
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
    { key: Priority.LOW, label: 'Low' },
    { key: Priority.MEDIUM, label: 'Medium' },
    { key: Priority.HIGH, label: 'High' },
    { key: Priority.URGENT, label: 'Urgent' },
  ];

  if (!task) return null;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose}
      placement="top-center"
      size="lg"
      scrollBehavior="inside"
      backdrop="blur"
    >
      <ModalContent>
        <form onSubmit={handleSubmit}>
          <ModalHeader className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold">Edit Task</h3>
          </ModalHeader>
          
          <ModalBody className="gap-4">
            {/* Title */}
            <Input
              autoFocus
              label="Title"
              placeholder="Enter task title..."
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              isRequired
              variant="bordered"
              size="sm"
            />

            {/* Description */}
            <Textarea
              label="Description"
              placeholder="Enter description..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              variant="bordered"
              size="sm"
              minRows={2}
              maxRows={4}
            />

            {/* Priority & Time Estimate Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Priority */}
              <Select
                label="Priority"
                placeholder="Select priority"
                selectedKeys={[formData.priority.toString()]}
                onSelectionChange={(keys) => {
                  const priority = Array.from(keys)[0] as string;
                  setFormData(prev => ({ ...prev, priority: parseInt(priority) as Priority }));
                }}
                variant="bordered"
                size="sm"
              >
                {priorityOptions.map((priority) => (
                  <SelectItem key={priority.key}>
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
                onChange={(e) => setFormData(prev => ({ ...prev, timeEstimate: parseInt(e.target.value) || 60 }))}
                min={15}
                step={15}
                variant="bordered"
                size="sm"
                startContent={<Clock className="w-3 h-3 opacity-50" />}
              />
            </div>

            {/* Dates Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Due Date */}
              <Input
                type="date"
                label="Due Date"
                value={formData.dueDate ? formData.dueDate.toISOString().split('T')[0] : ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  dueDate: e.target.value ? new Date(e.target.value) : undefined 
                }))}
                variant="bordered"
                size="sm"
                startContent={<Calendar className="w-3 h-3 opacity-50" />}
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
                variant="bordered"
                size="sm"
                startContent={<Calendar className="w-3 h-3 opacity-50" />}
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
                  variant="bordered"
                  size="sm"
                  startContent={<Hash className="w-3 h-3 opacity-50" />}
                />
                <Button
                  type="button"
                  onPress={addTag}
                  color="primary"
                  variant="flat"
                  size="sm"
                  isIconOnly
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
            >
              Cancel
            </Button>
            <Button 
              color="primary" 
              type="submit"
              isDisabled={!formData.title.trim()}
              size="sm"
              startContent={<Save className="w-3 h-3" />}
            >
              Save Changes
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
} 