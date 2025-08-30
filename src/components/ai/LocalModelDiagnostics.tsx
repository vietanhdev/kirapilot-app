import { useState, useEffect } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Chip,
  Divider,
} from '@heroui/react';
import { AlertCircle, CheckCircle, Download, RefreshCw } from 'lucide-react';
import {
  diagnoseLocalModel,
  LocalModelDiagnostics as DiagnosticsType,
} from '../../services/ai/LocalModelDiagnostics';

interface LocalModelDiagnosticsProps {
  onRetry?: () => void;
  isVisible?: boolean;
}

export function LocalModelDiagnostics({
  onRetry,
  isVisible = true,
}: LocalModelDiagnosticsProps) {
  const [diagnostics, setDiagnostics] = useState<DiagnosticsType | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isVisible) {
      runDiagnostics();
    }
  }, [isVisible]);

  const runDiagnostics = async () => {
    setIsLoading(true);
    try {
      const result = await diagnoseLocalModel();
      setDiagnostics(result);
    } catch (error) {
      console.error('Failed to run diagnostics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isVisible || !diagnostics) {
    return null;
  }

  const getStatusIcon = (isOk: boolean) => {
    return isOk ? (
      <CheckCircle className='w-4 h-4 text-success' />
    ) : (
      <AlertCircle className='w-4 h-4 text-danger' />
    );
  };

  const getStatusColor = (isOk: boolean) => {
    return isOk ? 'success' : 'danger';
  };

  return (
    <Card className='w-full max-w-2xl'>
      <CardHeader className='flex flex-row items-center justify-between'>
        <div className='flex flex-col'>
          <h3 className='text-lg font-semibold'>Local AI Model Diagnostics</h3>
          <p className='text-sm text-default-500'>
            System requirements and troubleshooting information
          </p>
        </div>
        <Button
          isIconOnly
          variant='light'
          onPress={runDiagnostics}
          isLoading={isLoading}
        >
          <RefreshCw className='w-4 h-4' />
        </Button>
      </CardHeader>

      <CardBody className='space-y-4'>
        {/* System Requirements */}
        <div>
          <h4 className='font-medium mb-2'>System Requirements</h4>
          <div className='flex items-center gap-2 mb-1'>
            {getStatusIcon(diagnostics.systemRequirements.hasRequiredMemory)}
            <span className='text-sm'>Memory Requirements</span>
            <Chip
              size='sm'
              color={getStatusColor(
                diagnostics.systemRequirements.hasRequiredMemory
              )}
              variant='flat'
            >
              {diagnostics.systemRequirements.availableMemoryGB.toFixed(1)}GB /{' '}
              {diagnostics.systemRequirements.requiredMemoryGB}GB
            </Chip>
          </div>
        </div>

        <Divider />

        {/* Model Status */}
        <div>
          <h4 className='font-medium mb-2'>Model Status</h4>
          <div className='flex items-center gap-2 mb-1'>
            {getStatusIcon(diagnostics.modelStatus.isDownloaded)}
            <span className='text-sm'>Model Downloaded</span>
            {diagnostics.modelStatus.isDownloaded &&
              diagnostics.modelStatus.modelSizeGB && (
                <Chip size='sm' color='primary' variant='flat'>
                  {diagnostics.modelStatus.modelSizeGB}GB
                </Chip>
              )}
          </div>
          {diagnostics.modelStatus.downloadProgress !== undefined && (
            <div className='flex items-center gap-2 mt-1'>
              <Download className='w-4 h-4 text-primary' />
              <span className='text-sm'>
                Download Progress: {diagnostics.modelStatus.downloadProgress}%
              </span>
            </div>
          )}
        </div>

        <Divider />

        {/* Dependencies */}
        <div>
          <h4 className='font-medium mb-2'>Dependencies</h4>
          <div className='space-y-1'>
            <div className='flex items-center gap-2'>
              {getStatusIcon(diagnostics.dependencies.llamaCppAvailable)}
              <span className='text-sm'>llama-cpp Backend</span>
            </div>
            <div className='flex items-center gap-2'>
              {getStatusIcon(diagnostics.dependencies.systemLibrariesAvailable)}
              <span className='text-sm'>System Libraries</span>
            </div>
          </div>
        </div>

        <Divider />

        {/* Recommendations */}
        <div>
          <h4 className='font-medium mb-2'>Recommendations</h4>
          <ul className='space-y-1'>
            {diagnostics.recommendations.map((recommendation, index) => (
              <li
                key={index}
                className='text-sm text-default-600 flex items-start gap-2'
              >
                <span className='text-primary mt-1'>•</span>
                <span>{recommendation}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        {onRetry && (
          <div className='flex justify-end pt-2'>
            <Button
              color='primary'
              onPress={onRetry}
              startContent={<RefreshCw className='w-4 h-4' />}
            >
              Retry Local Model
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
