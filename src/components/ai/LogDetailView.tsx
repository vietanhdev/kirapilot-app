import { useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Code,
  Accordion,
  AccordionItem,
  Snippet,
} from '@heroui/react';
import {
  X,
  Download,
  Trash2,
  Eye,
  EyeOff,
  Calendar,
  Clock,
  Cpu,
  Zap,
  AlertCircle,
  CheckCircle,
  Settings,
  MessageSquare,
  Bot,
  Wrench,
  BarChart3,
  Shield,
} from 'lucide-react';
import { AIInteractionLog } from '../../types/aiLogging';
interface LogDetailViewProps {
  log: AIInteractionLog;
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => void;
  onExport: () => void;
  onRedactSensitiveData: () => void;
}

export function LogDetailView({
  log,
  isOpen,
  onClose,
  onDelete,
  onExport,
  onRedactSensitiveData,
}: LogDetailViewProps) {
  const [showSensitiveData, setShowSensitiveData] = useState(false);

  const formatResponseTime = (ms: number) => {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getModelTypeColor = (modelType: string) => {
    switch (modelType) {
      case 'local':
        return 'primary';
      case 'gemini':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getDataClassificationColor = (classification: string) => {
    switch (classification) {
      case 'public':
        return 'success';
      case 'internal':
        return 'warning';
      case 'confidential':
        return 'danger';
      default:
        return 'default';
    }
  };

  const parseJsonSafely = function <T>(jsonString: string, fallback: T): T {
    try {
      return JSON.parse(jsonString);
    } catch {
      return fallback;
    }
  };

  const formatJson = (jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return jsonString;
    }
  };

  const actions = parseJsonSafely(log.actions, [] as unknown[]);
  const suggestions = parseJsonSafely(log.suggestions, [] as unknown[]);
  const context = parseJsonSafely(log.context, {});

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size='5xl'
      scrollBehavior='inside'
      classNames={{
        base: 'max-h-[90vh]',
        body: 'p-0',
      }}
    >
      <ModalContent>
        <ModalHeader className='flex items-center justify-between border-b'>
          <div className='flex items-center gap-3'>
            <div className='flex items-center gap-2'>
              <Chip
                size='sm'
                color={getModelTypeColor(log.modelType)}
                variant='flat'
                startContent={
                  log.modelType === 'local' ? (
                    <Cpu className='w-3 h-3' />
                  ) : (
                    <Zap className='w-3 h-3' />
                  )
                }
              >
                Gemini
              </Chip>

              {log.error && (
                <Chip
                  size='sm'
                  color='danger'
                  variant='flat'
                  startContent={<AlertCircle className='w-3 h-3' />}
                >
                  Error
                </Chip>
              )}

              <Chip
                size='sm'
                color={getDataClassificationColor(log.dataClassification)}
                variant='flat'
                startContent={<Shield className='w-3 h-3' />}
              >
                {log.dataClassification}
              </Chip>
            </div>

            <div className='text-sm text-default-500'>
              {log.timestamp.toLocaleString()}
            </div>
          </div>

          <Button isIconOnly variant='light' onPress={onClose}>
            <X className='w-4 h-4' />
          </Button>
        </ModalHeader>

        <ModalBody>
          <div className='p-6 space-y-6'>
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <h3 className='text-lg font-semibold flex items-center gap-2'>
                  <BarChart3 className='w-5 h-5' />
                  Basic Information
                </h3>
              </CardHeader>
              <CardBody className='space-y-4'>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div>
                    <label className='text-sm font-medium text-default-600'>
                      Session ID
                    </label>
                    <Snippet size='sm' symbol='' className='mt-1'>
                      {log.sessionId}
                    </Snippet>
                  </div>

                  <div>
                    <label className='text-sm font-medium text-default-600'>
                      Model Info
                    </label>
                    <div className='mt-1 text-sm'>
                      <p>
                        <strong>Name:</strong> {log.modelInfo.name}
                      </p>
                      {log.modelInfo.version && (
                        <p>
                          <strong>Version:</strong> {log.modelInfo.version}
                        </p>
                      )}
                      <p>
                        <strong>Provider:</strong> {log.modelInfo.provider}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className='text-sm font-medium text-default-600'>
                      Response Time
                    </label>
                    <div className='mt-1 flex items-center gap-2'>
                      <Clock className='w-4 h-4 text-default-400' />
                      <span className='text-sm'>
                        {formatResponseTime(log.responseTime)}
                      </span>
                    </div>
                  </div>

                  {log.tokenCount && (
                    <div>
                      <label className='text-sm font-medium text-default-600'>
                        Token Count
                      </label>
                      <div className='mt-1 text-sm'>
                        {log.tokenCount} tokens
                      </div>
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>

            {/* Conversation */}
            <Card>
              <CardHeader>
                <h3 className='text-lg font-semibold flex items-center gap-2'>
                  <MessageSquare className='w-5 h-5' />
                  Conversation
                </h3>
              </CardHeader>
              <CardBody className='space-y-4'>
                {/* User Message */}
                <div>
                  <label className='text-sm font-medium text-default-600 mb-2 block'>
                    User Message
                  </label>
                  <Card className='bg-primary-50 dark:bg-primary-950/20'>
                    <CardBody>
                      <p className='text-sm whitespace-pre-wrap'>
                        {log.userMessage}
                      </p>
                    </CardBody>
                  </Card>
                </div>

                {/* System Prompt */}
                {log.systemPrompt && (
                  <div>
                    <label className='text-sm font-medium text-default-600 mb-2 block'>
                      System Prompt
                    </label>
                    <Card className='bg-warning-50 dark:bg-warning-950/20'>
                      <CardBody>
                        <Code className='text-xs whitespace-pre-wrap'>
                          {log.systemPrompt}
                        </Code>
                      </CardBody>
                    </Card>
                  </div>
                )}

                {/* AI Response */}
                <div>
                  <label className='text-sm font-medium text-default-600 mb-2 block'>
                    AI Response
                  </label>
                  <Card className='bg-success-50 dark:bg-success-950/20'>
                    <CardBody>
                      <p className='text-sm whitespace-pre-wrap'>
                        {log.aiResponse}
                      </p>
                    </CardBody>
                  </Card>
                </div>

                {/* Reasoning */}
                {log.reasoning && (
                  <div>
                    <label className='text-sm font-medium text-default-600 mb-2 block'>
                      AI Reasoning
                    </label>
                    <Card className='bg-secondary-50 dark:bg-secondary-950/20'>
                      <CardBody>
                        <p className='text-sm whitespace-pre-wrap'>
                          {log.reasoning}
                        </p>
                      </CardBody>
                    </Card>
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Actions and Suggestions */}
            {(actions.length > 0 || suggestions.length > 0) && (
              <Card>
                <CardHeader>
                  <h3 className='text-lg font-semibold flex items-center gap-2'>
                    <Bot className='w-5 h-5' />
                    AI Actions & Suggestions
                  </h3>
                </CardHeader>
                <CardBody>
                  <Accordion>
                    <AccordionItem
                      key='actions'
                      title={`Actions (${actions.length})`}
                    >
                      <Code className='text-xs whitespace-pre-wrap'>
                        {formatJson(log.actions)}
                      </Code>
                    </AccordionItem>

                    <AccordionItem
                      key='suggestions'
                      title={`Suggestions (${suggestions.length})`}
                    >
                      <Code className='text-xs whitespace-pre-wrap'>
                        {formatJson(log.suggestions)}
                      </Code>
                    </AccordionItem>
                  </Accordion>
                </CardBody>
              </Card>
            )}

            {/* Tool Executions */}
            {log.toolCalls.length > 0 && (
              <Card>
                <CardHeader>
                  <h3 className='text-lg font-semibold flex items-center gap-2'>
                    <Wrench className='w-5 h-5' />
                    Tool Executions ({log.toolCalls.length})
                  </h3>
                </CardHeader>
                <CardBody>
                  <div className='space-y-4'>
                    {log.toolCalls.map(toolCall => (
                      <Card
                        key={toolCall.id}
                        className='bg-default-50 dark:bg-default-950/20'
                      >
                        <CardHeader className='pb-2'>
                          <div className='flex items-center justify-between w-full'>
                            <div className='flex items-center gap-2'>
                              <Chip
                                size='sm'
                                color={toolCall.success ? 'success' : 'danger'}
                                variant='flat'
                              >
                                {toolCall.toolName}
                              </Chip>
                              <span className='text-xs text-default-500'>
                                {formatResponseTime(toolCall.executionTime)}
                              </span>
                            </div>
                            {toolCall.success ? (
                              <CheckCircle className='w-4 h-4 text-success' />
                            ) : (
                              <AlertCircle className='w-4 h-4 text-danger' />
                            )}
                          </div>
                        </CardHeader>
                        <CardBody className='pt-0'>
                          <Accordion>
                            <AccordionItem key='arguments' title='Arguments'>
                              <Code className='text-xs whitespace-pre-wrap'>
                                {formatJson(toolCall.arguments)}
                              </Code>
                            </AccordionItem>
                            <AccordionItem key='result' title='Result'>
                              <Code className='text-xs whitespace-pre-wrap'>
                                {formatJson(toolCall.result)}
                              </Code>
                            </AccordionItem>
                            <AccordionItem key='error' title='Error'>
                              <Code className='text-xs text-danger whitespace-pre-wrap'>
                                {toolCall.error || 'No error'}
                              </Code>
                            </AccordionItem>
                          </Accordion>
                        </CardBody>
                      </Card>
                    ))}
                  </div>
                </CardBody>
              </Card>
            )}

            {/* Context Information */}
            {Object.keys(context).length > 0 && (
              <Card>
                <CardHeader>
                  <h3 className='text-lg font-semibold flex items-center gap-2'>
                    <Settings className='w-5 h-5' />
                    Context Information
                  </h3>
                </CardHeader>
                <CardBody>
                  <Code className='text-xs whitespace-pre-wrap'>
                    {formatJson(log.context)}
                  </Code>
                </CardBody>
              </Card>
            )}

            {/* Error Information */}
            {log.error && (
              <Card className='border-danger-200 dark:border-danger-800'>
                <CardHeader>
                  <h3 className='text-lg font-semibold flex items-center gap-2 text-danger'>
                    <AlertCircle className='w-5 h-5' />
                    Error Information
                  </h3>
                </CardHeader>
                <CardBody className='space-y-2'>
                  {log.errorCode && (
                    <div>
                      <label className='text-sm font-medium text-default-600'>
                        Error Code
                      </label>
                      <Code className='mt-1 text-danger'>{log.errorCode}</Code>
                    </div>
                  )}
                  <div>
                    <label className='text-sm font-medium text-default-600'>
                      Error Message
                    </label>
                    <Code className='mt-1 text-danger whitespace-pre-wrap'>
                      {log.error}
                    </Code>
                  </div>
                </CardBody>
              </Card>
            )}

            {/* Privacy Information */}
            {log.containsSensitiveData && (
              <Card className='border-warning-200 dark:border-warning-800'>
                <CardHeader>
                  <h3 className='text-lg font-semibold flex items-center gap-2 text-warning'>
                    <Shield className='w-5 h-5' />
                    Privacy Information
                  </h3>
                </CardHeader>
                <CardBody>
                  <div className='flex items-center justify-between'>
                    <div>
                      <p className='text-sm'>
                        This log contains sensitive data
                      </p>
                      <p className='text-xs text-default-500 mt-1'>
                        Classification: {log.dataClassification}
                      </p>
                    </div>
                    <div className='flex items-center gap-2'>
                      <Button
                        size='sm'
                        variant='flat'
                        color='warning'
                        startContent={
                          showSensitiveData ? (
                            <EyeOff className='w-4 h-4' />
                          ) : (
                            <Eye className='w-4 h-4' />
                          )
                        }
                        onPress={() => setShowSensitiveData(!showSensitiveData)}
                      >
                        {showSensitiveData ? 'Hide' : 'Show'} Sensitive Data
                      </Button>
                      <Button
                        size='sm'
                        variant='flat'
                        color='danger'
                        onPress={onRedactSensitiveData}
                      >
                        Redact Data
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            )}

            {/* Metadata */}
            <Card>
              <CardHeader>
                <h3 className='text-lg font-semibold'>Metadata</h3>
              </CardHeader>
              <CardBody>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4 text-sm'>
                  <div>
                    <label className='font-medium text-default-600'>
                      Created At
                    </label>
                    <div className='flex items-center gap-2 mt-1'>
                      <Calendar className='w-4 h-4 text-default-400' />
                      {log.createdAt.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <label className='font-medium text-default-600'>
                      Updated At
                    </label>
                    <div className='flex items-center gap-2 mt-1'>
                      <Calendar className='w-4 h-4 text-default-400' />
                      {log.updatedAt.toLocaleString()}
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </ModalBody>

        <ModalFooter className='border-t'>
          <div className='flex items-center justify-between w-full'>
            <div className='flex items-center gap-2'>
              <Button
                variant='flat'
                size='sm'
                startContent={<Download className='w-4 h-4' />}
                onPress={onExport}
              >
                Export
              </Button>
            </div>

            <div className='flex items-center gap-2'>
              <Button
                variant='flat'
                color='danger'
                size='sm'
                startContent={<Trash2 className='w-4 h-4' />}
                onPress={onDelete}
              >
                Delete
              </Button>
              <Button color='primary' onPress={onClose}>
                Close
              </Button>
            </div>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
