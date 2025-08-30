import React, { useState, useEffect } from 'react';
import {
  Card,
  CardBody,
  Select,
  SelectItem,
  Chip,
  Progress,
} from '@heroui/react';
import { HardDrive, Download, CheckCircle, Zap, Cpu } from 'lucide-react';

interface AvailableModel {
  id: string;
  name: string;
  description: string;
  repo: string;
  filename: string;
  size_mb: number;
  parameter_count: string;
  quantization: string;
}

interface LocalModelSelectorProps {
  onModelChange: (modelId: string) => void;
  isLoading?: boolean;
  className?: string;
}

export const LocalModelSelector: React.FC<LocalModelSelectorProps> = ({
  onModelChange,
  isLoading = false,
  className = '',
}) => {
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [currentModel, setCurrentModel] = useState<AvailableModel | null>(null);
  const [loading, setLoading] = useState(true);

  // Load available models and current model info
  useEffect(() => {
    const loadModels = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');

        // Get available models
        const models = await invoke<AvailableModel[]>('get_available_models');
        setAvailableModels(models);

        // Get current model info
        const currentModelInfo = await invoke<AvailableModel | null>(
          'get_current_model_info'
        );
        setCurrentModel(currentModelInfo);
      } catch (error) {
        console.error('Failed to load model information:', error);
      } finally {
        setLoading(false);
      }
    };

    loadModels();
  }, []);

  const handleModelChange = async (modelId: string) => {
    if (isLoading) {
      return;
    }

    const selectedModel = availableModels.find(m => m.id === modelId);
    if (!selectedModel) {
      return;
    }

    // Update current model optimistically
    setCurrentModel(selectedModel);

    // Call the parent handler
    onModelChange(modelId);
  };

  const getQuantizationColor = (quantization: string) => {
    switch (quantization) {
      case 'Q8_0':
        return 'success';
      case 'Q4_K_M':
        return 'primary';
      case 'Q3_K_M':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getQuantizationIcon = (quantization: string) => {
    switch (quantization) {
      case 'Q8_0':
        return <CheckCircle className='w-3 h-3' />;
      case 'Q4_K_M':
        return <Cpu className='w-3 h-3' />;
      case 'Q3_K_M':
        return <Zap className='w-3 h-3' />;
      default:
        return <HardDrive className='w-3 h-3' />;
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardBody className='p-4'>
          <div className='flex items-center justify-center py-4'>
            <HardDrive className='w-6 h-6 text-foreground-600 animate-pulse' />
            <span className='ml-2 text-sm text-foreground-600'>
              Loading models...
            </span>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardBody className='p-4'>
        <div className='space-y-4'>
          <div>
            <h4 className='text-md font-medium text-foreground mb-1 flex items-center gap-2'>
              <HardDrive className='w-4 h-4' />
              Local Model
            </h4>
            <p className='text-sm text-foreground-600'>
              Choose the model variant for local inference
            </p>
          </div>

          {/* Current Model */}
          {currentModel && (
            <div className='p-3 bg-content2 rounded-lg'>
              <div className='flex items-center justify-between'>
                <div>
                  <div className='flex items-center gap-2 mb-1'>
                    <CheckCircle className='w-4 h-4 text-success' />
                    <span className='text-sm font-medium text-foreground'>
                      {currentModel.name}
                    </span>
                  </div>
                  <div className='flex items-center gap-2'>
                    <Chip
                      size='sm'
                      color={
                        getQuantizationColor(currentModel.quantization) as any
                      }
                      variant='flat'
                      startContent={getQuantizationIcon(
                        currentModel.quantization
                      )}
                    >
                      {currentModel.quantization}
                    </Chip>
                    <Chip size='sm' variant='bordered'>
                      {currentModel.size_mb}MB
                    </Chip>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Model Selection */}
          <div>
            <Select
              selectedKeys={currentModel ? [currentModel.id] : []}
              onSelectionChange={keys => {
                const modelId = Array.from(keys)[0] as string;
                if (modelId && modelId !== currentModel?.id) {
                  handleModelChange(modelId);
                }
              }}
              isDisabled={isLoading}
              size='sm'
              placeholder='Select a model'
              classNames={{
                trigger:
                  'bg-content2 border-divider data-[hover=true]:bg-content3',
              }}
            >
              {availableModels.map(model => (
                <SelectItem
                  key={model.id}
                  startContent={getQuantizationIcon(model.quantization)}
                  description={`${model.size_mb}MB • ${model.parameter_count}`}
                >
                  {model.name}
                </SelectItem>
              ))}
            </Select>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <span className='text-sm text-foreground flex items-center gap-2'>
                  <Download className='w-4 h-4' />
                  Switching model...
                </span>
              </div>
              <Progress
                isIndeterminate
                color='primary'
                size='sm'
                aria-label='Switching model'
              />
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
};
