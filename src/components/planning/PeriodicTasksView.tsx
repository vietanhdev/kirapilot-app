import { useState } from 'react';
import { Button } from '@heroui/react';
import { Plus, RefreshCw } from 'lucide-react';
import { PeriodicTaskTemplate } from '../../types';
import { PeriodicTaskList } from './PeriodicTaskList';
import { PeriodicTaskModal } from './PeriodicTaskModal';
import { PeriodicTaskService } from '../../services/database/repositories/PeriodicTaskService';
import { useTranslation } from '../../hooks/useTranslation';

export function PeriodicTasksView() {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<
    PeriodicTaskTemplate | undefined
  >();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleCreateTemplate = () => {
    setEditingTemplate(undefined);
    setIsModalOpen(true);
  };

  const handleEditTemplate = (template: PeriodicTaskTemplate) => {
    setEditingTemplate(template);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTemplate(undefined);
  };

  const handleTemplateCreated = async (_template: PeriodicTaskTemplate) => {
    setIsModalOpen(false);
    setEditingTemplate(undefined);
    // Force refresh of the PeriodicTaskList
    window.dispatchEvent(new CustomEvent('periodic-tasks-updated'));
  };

  const handleTemplateUpdated = async (_template: PeriodicTaskTemplate) => {
    setIsModalOpen(false);
    setEditingTemplate(undefined);
    // Force refresh of the PeriodicTaskList
    window.dispatchEvent(new CustomEvent('periodic-tasks-updated'));
  };

  const handleGenerateInstances = async () => {
    setIsGenerating(true);
    try {
      const periodicService = new PeriodicTaskService();

      // Generate instances for the next 30 days
      const result = await periodicService.generateAdvancedInstances(30);

      // Notify both periodic tasks list and planner to refresh
      window.dispatchEvent(new CustomEvent('periodic-tasks-updated'));

      if (result.totalGenerated > 0) {
        alert(
          `Generated ${result.totalGenerated} new task instances for the next 30 days!`
        );
      } else {
        alert('All task instances for the next 30 days are already generated.');
      }
    } catch (error) {
      console.error('Failed to generate periodic task instances:', error);
      alert('Failed to generate task instances. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className='p-6 min-h-full space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-foreground'>
            {t('periodicTasks.title') || 'Recurring Tasks'}
          </h1>
          <p className='text-sm text-foreground-600 mt-1'>
            {t('periodicTasks.description') ||
              'Manage templates for automatically recurring tasks'}
          </p>
        </div>
        <div className='flex gap-2'>
          <Button
            color='default'
            variant='flat'
            startContent={<RefreshCw className='w-4 h-4' />}
            onPress={handleGenerateInstances}
            isLoading={isGenerating}
          >
            Generate Next 30 Days
          </Button>
          <Button
            color='primary'
            startContent={<Plus className='w-4 h-4' />}
            onPress={handleCreateTemplate}
          >
            {t('periodicTasks.createTemplate') || 'Create Template'}
          </Button>
        </div>
      </div>

      {/* Periodic Tasks List */}
      <PeriodicTaskList
        onEditTemplate={handleEditTemplate}
        onTemplateUpdated={handleTemplateUpdated}
        className='flex-1'
      />

      {/* Create/Edit Modal */}
      <PeriodicTaskModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onCreateTemplate={handleTemplateCreated}
        onUpdateTemplate={handleTemplateUpdated}
        template={editingTemplate}
      />
    </div>
  );
}
