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
  Bot,
  User,
  Clock,
  Cpu,
  Zap,
  AlertCircle,
  CheckCircle,
  Wrench,
  MessageSquare,
  Brain,
  Target,
  Activity,
  Info,
  Eye,
  EyeOff,
} from 'lucide-react';
import { EnhancedInteractionLogEntry } from '../../types/aiLogging';
import { MarkdownRenderer } from '../common';

interface InteractionDetailsModalProps {
  interaction: EnhancedInteractionLogEntry | null;
  isOpen: boolean;
  onClose: () => void;
}

export function InteractionDetailsModal({
  interaction,
  isOpen,
  onClose,
}: InteractionDetailsModalProps) {
  const [showSensitiveData, setShowSensitiveData] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['conversation'])
  );

  if (!interaction) {
    return null;
  }

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

  const getConfidenceColor = (score?: number) => {
    if (!score) {
      return 'default';
    }
    if (score >= 80) {
      return 'success';
    }
    if (score >= 60) {
      return 'warning';
    }
    return 'danger';
  };

  const parseJsonSafely = function <T>(jsonString: string, fallback: T): T {
    try {
      return JSON.parse(jsonString) as T;
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

  const actions = parseJsonSafely(
    interaction.actions,
    [] as Array<Record<string, unknown>>
  );
  const suggestions = parseJsonSafely(
    interaction.suggestions,
    [] as Array<Record<string, unknown>>
  );

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

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
        <ModalHeader className='flex items-center justify-between border-b bg-content2'>
          <div className='flex items-center gap-3'>
            <div className='flex items-center gap-2'>
              <Chip
                size='sm'
                color={getModelTypeColor(interaction.modelType)}
                variant='flat'
                startContent={
                  interaction.modelType === 'local' ? (
                    <Cpu className='w-3 h-3' />
                  ) : (
                    <Zap className='w-3 h-3' />
                  )
                }
              >
                {interaction.modelType === 'local' ? 'Local AI' : 'Gemini'}
              </Chip>

              {interaction.error && (
                <Chip
                  size='sm'
                  color='danger'
                  variant='flat'
                  startContent={<AlertCircle className='w-3 h-3' />}
                >
                  Error
                </Chip>
              )}

              {interaction.confidenceScore && (
                <Chip
                  size='sm'
                  color={getConfidenceColor(interaction.confidenceScore)}
                  variant='flat'
                  startContent={<Target className='w-3 h-3' />}
                >
                  {interaction.confidenceScore}% confidence
                </Chip>
              )}
            </div>

            <div className='text-sm text-foreground-600'>
              <div className='flex items-center gap-1'>
                <Clock className='w-3 h-3' />
                {interaction.timestamp.toLocaleString()}
              </div>
            </div>
          </div>

          <Button isIconOnly variant='light' onPress={onClose}>
            <X className='w-4 h-4' />
          </Button>
        </ModalHeader>

        <ModalBody>
          <div className='p-6 space-y-6'>
            {/* Quick Stats */}
            <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
              <Card className='bg-primary-50 dark:bg-primary-950/20'>
                <CardBody className='p-3 text-center'>
                  <div className='flex items-center justify-center gap-1 mb-1'>
                    <Clock className='w-4 h-4 text-primary-500' />
                    <span className='text-xs font-medium text-primary-700 dark:text-primary-300'>
                      Response Time
                    </span>
                  </div>
                  <div className='text-lg font-bold text-primary-600 dark:text-primary-400'>
                    {formatResponseTime(interaction.responseTime)}
                  </div>
                </CardBody>
              </Card>

              <Card className='bg-success-50 dark:bg-success-950/20'>
                <CardBody className='p-3 text-center'>
                  <div className='flex items-center justify-center gap-1 mb-1'>
                    <Wrench className='w-4 h-4 text-success-500' />
                    <span className='text-xs font-medium text-success-700 dark:text-success-300'>
                      Tools Used
                    </span>
                  </div>
                  <div className='text-lg font-bold text-success-600 dark:text-success-400'>
                    {interaction.toolExecutions.length}
                  </div>
                </CardBody>
              </Card>

              {interaction.tokenCount && (
                <Card className='bg-warning-50 dark:bg-warning-950/20'>
                  <CardBody className='p-3 text-center'>
                    <div className='flex items-center justify-center gap-1 mb-1'>
                      <Activity className='w-4 h-4 text-warning-500' />
                      <span className='text-xs font-medium text-warning-700 dark:text-warning-300'>
                        Tokens
                      </span>
                    </div>
                    <div className='text-lg font-bold text-warning-600 dark:text-warning-400'>
                      {interaction.tokenCount}
                    </div>
                  </CardBody>
                </Card>
              )}

              {interaction.userIntent && (
                <Card className='bg-secondary-50 dark:bg-secondary-950/20'>
                  <CardBody className='p-3 text-center'>
                    <div className='flex items-center justify-center gap-1 mb-1'>
                      <Target className='w-4 h-4 text-secondary-500' />
                      <span className='text-xs font-medium text-secondary-700 dark:text-secondary-300'>
                        Intent
                      </span>
                    </div>
                    <div className='text-xs font-medium text-secondary-600 dark:text-secondary-400 capitalize'>
                      {interaction.userIntent.replace('_', ' ')}
                    </div>
                  </CardBody>
                </Card>
              )}
            </div>

            {/* Conversation Section */}
            <Card>
              <CardHeader
                className='cursor-pointer hover:bg-content2 transition-colors'
                onClick={() => toggleSection('conversation')}
              >
                <div className='flex items-center justify-between w-full'>
                  <h3 className='text-lg font-semibold flex items-center gap-2'>
                    <MessageSquare className='w-5 h-5' />
                    Conversation
                  </h3>
                  <Button
                    isIconOnly
                    variant='light'
                    size='sm'
                    className='text-foreground-500'
                  >
                    {expandedSections.has('conversation') ? '−' : '+'}
                  </Button>
                </div>
              </CardHeader>
              {expandedSections.has('conversation') && (
                <CardBody className='space-y-4'>
                  {/* User Message */}
                  <div>
                    <div className='flex items-center gap-2 mb-2'>
                      <User className='w-4 h-4 text-primary-500' />
                      <label className='text-sm font-medium text-foreground-700'>
                        User Message
                      </label>
                    </div>
                    <Card className='bg-primary-50 dark:bg-primary-950/20 border-l-4 border-primary-500'>
                      <CardBody>
                        <MarkdownRenderer
                          content={interaction.userMessage}
                          className='text-sm'
                        />
                      </CardBody>
                    </Card>
                  </div>

                  {/* AI Response */}
                  <div>
                    <div className='flex items-center gap-2 mb-2'>
                      <Bot className='w-4 h-4 text-success-500' />
                      <label className='text-sm font-medium text-foreground-700'>
                        AI Response
                      </label>
                    </div>
                    <Card className='bg-success-50 dark:bg-success-950/20 border-l-4 border-success-500'>
                      <CardBody>
                        <MarkdownRenderer
                          content={interaction.aiResponse}
                          className='text-sm'
                        />
                      </CardBody>
                    </Card>
                  </div>
                </CardBody>
              )}
            </Card>

            {/* AI Reasoning Section */}
            {(interaction.reasoning || interaction.reasoningChain) && (
              <Card>
                <CardHeader
                  className='cursor-pointer hover:bg-content2 transition-colors'
                  onClick={() => toggleSection('reasoning')}
                >
                  <div className='flex items-center justify-between w-full'>
                    <h3 className='text-lg font-semibold flex items-center gap-2'>
                      <Brain className='w-5 h-5' />
                      AI Reasoning & Decision Process
                    </h3>
                    <Button
                      isIconOnly
                      variant='light'
                      size='sm'
                      className='text-foreground-500'
                    >
                      {expandedSections.has('reasoning') ? '−' : '+'}
                    </Button>
                  </div>
                </CardHeader>
                {expandedSections.has('reasoning') && (
                  <CardBody className='space-y-4'>
                    {interaction.reasoning && (
                      <div>
                        <label className='text-sm font-medium text-foreground-700 mb-2 block'>
                          Primary Reasoning
                        </label>
                        <Card className='bg-secondary-50 dark:bg-secondary-950/20'>
                          <CardBody>
                            <MarkdownRenderer
                              content={interaction.reasoning}
                              className='text-sm'
                            />
                          </CardBody>
                        </Card>
                      </div>
                    )}

                    {interaction.reasoningChain &&
                      interaction.reasoningChain.length > 0 && (
                        <div>
                          <label className='text-sm font-medium text-foreground-700 mb-2 block'>
                            Reasoning Chain ({interaction.reasoningChain.length}{' '}
                            steps)
                          </label>
                          <div className='space-y-2'>
                            {interaction.reasoningChain.map((step, index) => (
                              <Card
                                key={index}
                                className='bg-content2 border-l-2 border-secondary-400'
                              >
                                <CardBody className='py-2'>
                                  <div className='flex items-start gap-2'>
                                    <Chip
                                      size='sm'
                                      variant='flat'
                                      color='secondary'
                                      className='mt-0.5'
                                    >
                                      {index + 1}
                                    </Chip>
                                    <p className='text-sm flex-1'>{step}</p>
                                  </div>
                                </CardBody>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}

                    {interaction.confidenceScore && (
                      <div>
                        <label className='text-sm font-medium text-foreground-700 mb-2 block'>
                          Confidence Assessment
                        </label>
                        <Card className='bg-content2'>
                          <CardBody>
                            <div className='flex items-center justify-between'>
                              <span className='text-sm'>
                                Overall Confidence
                              </span>
                              <Chip
                                size='sm'
                                color={getConfidenceColor(
                                  interaction.confidenceScore
                                )}
                                variant='flat'
                              >
                                {interaction.confidenceScore}%
                              </Chip>
                            </div>
                          </CardBody>
                        </Card>
                      </div>
                    )}
                  </CardBody>
                )}
              </Card>
            )}

            {/* Tool Executions Section */}
            {interaction.toolExecutions.length > 0 && (
              <Card>
                <CardHeader
                  className='cursor-pointer hover:bg-content2 transition-colors'
                  onClick={() => toggleSection('tools')}
                >
                  <div className='flex items-center justify-between w-full'>
                    <h3 className='text-lg font-semibold flex items-center gap-2'>
                      <Wrench className='w-5 h-5' />
                      Tool Executions ({interaction.toolExecutions.length})
                    </h3>
                    <Button
                      isIconOnly
                      variant='light'
                      size='sm'
                      className='text-foreground-500'
                    >
                      {expandedSections.has('tools') ? '−' : '+'}
                    </Button>
                  </div>
                </CardHeader>
                {expandedSections.has('tools') && (
                  <CardBody>
                    <div className='space-y-4'>
                      {interaction.toolExecutions.map((tool, index) => (
                        <Card
                          key={tool.id}
                          className={`border-l-4 ${
                            tool.success
                              ? 'border-success-500 bg-success-50 dark:bg-success-950/20'
                              : 'border-danger-500 bg-danger-50 dark:bg-danger-950/20'
                          }`}
                        >
                          <CardHeader className='pb-2'>
                            <div className='flex items-center justify-between w-full'>
                              <div className='flex items-center gap-2'>
                                <Chip size='sm' variant='flat' color='default'>
                                  #{index + 1}
                                </Chip>
                                <Chip
                                  size='sm'
                                  color={tool.success ? 'success' : 'danger'}
                                  variant='flat'
                                  startContent={
                                    tool.success ? (
                                      <CheckCircle className='w-3 h-3' />
                                    ) : (
                                      <AlertCircle className='w-3 h-3' />
                                    )
                                  }
                                >
                                  {tool.toolName}
                                </Chip>
                                <span className='text-xs text-foreground-500'>
                                  {formatResponseTime(tool.executionTime)}
                                </span>
                                {tool.userConfirmed && (
                                  <Chip
                                    size='sm'
                                    color='primary'
                                    variant='flat'
                                  >
                                    User Confirmed
                                  </Chip>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          <CardBody className='pt-0'>
                            <Accordion variant='light'>
                              {tool.reasoning ? (
                                <AccordionItem
                                  key='reasoning'
                                  title='Reasoning'
                                  startContent={<Brain className='w-4 h-4' />}
                                >
                                  <p className='text-sm text-foreground-700 whitespace-pre-wrap'>
                                    {tool.reasoning}
                                  </p>
                                </AccordionItem>
                              ) : null}

                              <AccordionItem
                                key='arguments'
                                title='Arguments'
                                startContent={<Info className='w-4 h-4' />}
                              >
                                <Code className='text-xs whitespace-pre-wrap'>
                                  {formatJson(tool.arguments)}
                                </Code>
                              </AccordionItem>

                              <AccordionItem
                                key='result'
                                title='Result'
                                startContent={
                                  tool.success ? (
                                    <CheckCircle className='w-4 h-4 text-success' />
                                  ) : (
                                    <AlertCircle className='w-4 h-4 text-danger' />
                                  )
                                }
                              >
                                <Code className='text-xs whitespace-pre-wrap'>
                                  {formatJson(tool.result)}
                                </Code>
                              </AccordionItem>

                              {tool.error ? (
                                <AccordionItem
                                  key='error'
                                  title='Error Details'
                                  startContent={
                                    <AlertCircle className='w-4 h-4 text-danger' />
                                  }
                                >
                                  <Code className='text-xs text-danger whitespace-pre-wrap'>
                                    {tool.error}
                                  </Code>
                                </AccordionItem>
                              ) : null}
                            </Accordion>
                          </CardBody>
                        </Card>
                      ))}
                    </div>
                  </CardBody>
                )}
              </Card>
            )}

            {/* Actions and Suggestions */}
            {(actions.length > 0 || suggestions.length > 0) && (
              <Card>
                <CardHeader
                  className='cursor-pointer hover:bg-content2 transition-colors'
                  onClick={() => toggleSection('actions')}
                >
                  <div className='flex items-center justify-between w-full'>
                    <h3 className='text-lg font-semibold flex items-center gap-2'>
                      <Bot className='w-5 h-5' />
                      AI Actions & Suggestions
                    </h3>
                    <Button
                      isIconOnly
                      variant='light'
                      size='sm'
                      className='text-foreground-500'
                    >
                      {expandedSections.has('actions') ? '−' : '+'}
                    </Button>
                  </div>
                </CardHeader>
                {expandedSections.has('actions') && (
                  <CardBody>
                    <Accordion variant='light'>
                      {actions.length > 0 ? (
                        <AccordionItem
                          key='actions'
                          title={`Actions (${actions.length})`}
                          startContent={<Activity className='w-4 h-4' />}
                        >
                          <Code className='text-xs whitespace-pre-wrap'>
                            {formatJson(interaction.actions)}
                          </Code>
                        </AccordionItem>
                      ) : null}

                      {suggestions.length > 0 ? (
                        <AccordionItem
                          key='suggestions'
                          title={`Suggestions (${suggestions.length})`}
                          startContent={<Target className='w-4 h-4' />}
                        >
                          <Code className='text-xs whitespace-pre-wrap'>
                            {formatJson(interaction.suggestions)}
                          </Code>
                        </AccordionItem>
                      ) : null}
                    </Accordion>
                  </CardBody>
                )}
              </Card>
            )}

            {/* Emotional Context */}
            {interaction.emotionalContext && (
              <Card>
                <CardHeader
                  className='cursor-pointer hover:bg-content2 transition-colors'
                  onClick={() => toggleSection('emotional')}
                >
                  <div className='flex items-center justify-between w-full'>
                    <h3 className='text-lg font-semibold flex items-center gap-2'>
                      <Activity className='w-5 h-5' />
                      Emotional Context
                    </h3>
                    <Button
                      isIconOnly
                      variant='light'
                      size='sm'
                      className='text-foreground-500'
                    >
                      {expandedSections.has('emotional') ? '−' : '+'}
                    </Button>
                  </div>
                </CardHeader>
                {expandedSections.has('emotional') && (
                  <CardBody className='space-y-4'>
                    <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                      <div className='text-center'>
                        <div className='text-xs text-foreground-600 mb-1'>
                          Energy
                        </div>
                        <div className='text-lg font-bold text-primary-600'>
                          {interaction.emotionalContext.currentMood.energy}/10
                        </div>
                      </div>
                      <div className='text-center'>
                        <div className='text-xs text-foreground-600 mb-1'>
                          Focus
                        </div>
                        <div className='text-lg font-bold text-success-600'>
                          {interaction.emotionalContext.currentMood.focus}/10
                        </div>
                      </div>
                      <div className='text-center'>
                        <div className='text-xs text-foreground-600 mb-1'>
                          Motivation
                        </div>
                        <div className='text-lg font-bold text-warning-600'>
                          {interaction.emotionalContext.currentMood.motivation}
                          /10
                        </div>
                      </div>
                      <div className='text-center'>
                        <div className='text-xs text-foreground-600 mb-1'>
                          Stress
                        </div>
                        <div className='text-lg font-bold text-danger-600'>
                          {interaction.emotionalContext.currentMood.stress}/10
                        </div>
                      </div>
                    </div>

                    {interaction.emotionalContext.stressIndicators.length >
                      0 && (
                      <div>
                        <label className='text-sm font-medium text-foreground-700 mb-2 block'>
                          Stress Indicators
                        </label>
                        <div className='flex flex-wrap gap-2'>
                          {interaction.emotionalContext.stressIndicators.map(
                            (indicator, index) => (
                              <Chip
                                key={index}
                                size='sm'
                                color='danger'
                                variant='flat'
                              >
                                {indicator.type.replace('_', ' ')}
                              </Chip>
                            )
                          )}
                        </div>
                      </div>
                    )}

                    {interaction.emotionalContext.supportNeeds.length > 0 && (
                      <div>
                        <label className='text-sm font-medium text-foreground-700 mb-2 block'>
                          Support Needs
                        </label>
                        <div className='flex flex-wrap gap-2'>
                          {interaction.emotionalContext.supportNeeds.map(
                            (need, index) => (
                              <Chip
                                key={index}
                                size='sm'
                                color='primary'
                                variant='flat'
                              >
                                {need.type.replace('_', ' ')}
                              </Chip>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </CardBody>
                )}
              </Card>
            )}

            {/* Performance Metrics */}
            {interaction.performanceMetrics && (
              <Card>
                <CardHeader
                  className='cursor-pointer hover:bg-content2 transition-colors'
                  onClick={() => toggleSection('performance')}
                >
                  <div className='flex items-center justify-between w-full'>
                    <h3 className='text-lg font-semibold flex items-center gap-2'>
                      <Activity className='w-5 h-5' />
                      Performance Metrics
                    </h3>
                    <Button
                      isIconOnly
                      variant='light'
                      size='sm'
                      className='text-foreground-500'
                    >
                      {expandedSections.has('performance') ? '−' : '+'}
                    </Button>
                  </div>
                </CardHeader>
                {expandedSections.has('performance') && (
                  <CardBody>
                    <div className='grid grid-cols-1 md:grid-cols-3 gap-4 text-sm'>
                      <div>
                        <label className='font-medium text-foreground-600'>
                          Total Duration
                        </label>
                        <div className='mt-1'>
                          {formatResponseTime(
                            interaction.performanceMetrics.totalDuration
                          )}
                        </div>
                      </div>
                      {interaction.performanceMetrics.memoryUsage && (
                        <div>
                          <label className='font-medium text-foreground-600'>
                            Memory Usage
                          </label>
                          <div className='mt-1'>
                            {(
                              interaction.performanceMetrics.memoryUsage /
                              1024 /
                              1024
                            ).toFixed(1)}{' '}
                            MB
                          </div>
                        </div>
                      )}
                      {interaction.performanceMetrics.networkLatency && (
                        <div>
                          <label className='font-medium text-foreground-600'>
                            Network Latency
                          </label>
                          <div className='mt-1'>
                            {formatResponseTime(
                              interaction.performanceMetrics.networkLatency
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {interaction.performanceMetrics.processingSteps.length >
                      0 && (
                      <div className='mt-4'>
                        <label className='text-sm font-medium text-foreground-700 mb-2 block'>
                          Processing Steps
                        </label>
                        <div className='space-y-2'>
                          {interaction.performanceMetrics.processingSteps.map(
                            (step, index) => (
                              <div
                                key={index}
                                className='flex items-center justify-between p-2 bg-content2 rounded-lg'
                              >
                                <span className='text-sm'>{step.step}</span>
                                <span className='text-xs text-foreground-500'>
                                  {formatResponseTime(step.duration)}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </CardBody>
                )}
              </Card>
            )}

            {/* Privacy Information */}
            {interaction.containsSensitiveData && (
              <Card className='border-warning-200 dark:border-warning-800'>
                <CardHeader>
                  <h3 className='text-lg font-semibold flex items-center gap-2 text-warning'>
                    <Eye className='w-5 h-5' />
                    Privacy Information
                  </h3>
                </CardHeader>
                <CardBody>
                  <div className='flex items-center justify-between'>
                    <div>
                      <p className='text-sm'>
                        This interaction contains sensitive data
                      </p>
                      <p className='text-xs text-foreground-500 mt-1'>
                        Classification: {interaction.dataClassification}
                      </p>
                    </div>
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
                  </div>
                </CardBody>
              </Card>
            )}

            {/* Session Information */}
            <Card>
              <CardHeader>
                <h3 className='text-lg font-semibold flex items-center gap-2'>
                  <Info className='w-5 h-5' />
                  Session Information
                </h3>
              </CardHeader>
              <CardBody>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4 text-sm'>
                  <div>
                    <label className='font-medium text-foreground-600'>
                      Session ID
                    </label>
                    <Snippet size='sm' symbol='' className='mt-1'>
                      {interaction.sessionId}
                    </Snippet>
                  </div>
                  <div>
                    <label className='font-medium text-foreground-600'>
                      Model Info
                    </label>
                    <div className='mt-1'>
                      <p>
                        <strong>Name:</strong> {interaction.modelInfo.name}
                      </p>
                      {interaction.modelInfo.version && (
                        <p>
                          <strong>Version:</strong>{' '}
                          {interaction.modelInfo.version}
                        </p>
                      )}
                      <p>
                        <strong>Provider:</strong>{' '}
                        {interaction.modelInfo.provider}
                      </p>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Error Information */}
            {interaction.error && (
              <Card className='border-danger-200 dark:border-danger-800'>
                <CardHeader>
                  <h3 className='text-lg font-semibold flex items-center gap-2 text-danger'>
                    <AlertCircle className='w-5 h-5' />
                    Error Information
                  </h3>
                </CardHeader>
                <CardBody className='space-y-2'>
                  {interaction.errorCode && (
                    <div>
                      <label className='text-sm font-medium text-foreground-600'>
                        Error Code
                      </label>
                      <Code className='mt-1 text-danger'>
                        {interaction.errorCode}
                      </Code>
                    </div>
                  )}
                  <div>
                    <label className='text-sm font-medium text-foreground-600'>
                      Error Message
                    </label>
                    <Code className='mt-1 text-danger whitespace-pre-wrap'>
                      {interaction.error}
                    </Code>
                  </div>
                </CardBody>
              </Card>
            )}
          </div>
        </ModalBody>

        <ModalFooter className='border-t bg-content2'>
          <div className='flex items-center justify-between w-full'>
            <div className='text-xs text-foreground-500'>
              Interaction ID: {interaction.id}
            </div>
            <Button color='primary' onPress={onClose}>
              Close
            </Button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
