import { useState } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Chip,
  Code,
  Accordion,
  AccordionItem,
  Button,
  Divider,
} from '@heroui/react';
import {
  Brain,
  Zap,
  Eye,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Play,
  AlertCircle,
} from 'lucide-react';
import { ReActStep, ReActStepType } from '../../types/aiLogging';

interface ReActStepsViewerProps {
  steps: ReActStep[];
  className?: string;
  showTimestamps?: boolean;
  showExecutionTimes?: boolean;
  expandAll?: boolean;
}

export function ReActStepsViewer({
  steps,
  className,
  showTimestamps = true,
  showExecutionTimes = true,
  expandAll = false,
}: ReActStepsViewerProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(
    expandAll ? new Set(steps.map(step => step.id)) : new Set()
  );

  const toggleStep = (stepId: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  const toggleAll = () => {
    if (expandedSteps.size === steps.length) {
      setExpandedSteps(new Set());
    } else {
      setExpandedSteps(new Set(steps.map(step => step.id)));
    }
  };

  const getStepIcon = (stepType: ReActStepType) => {
    switch (stepType) {
      case ReActStepType.Thought:
        return <Brain className='w-4 h-4' />;
      case ReActStepType.Action:
        return <Zap className='w-4 h-4' />;
      case ReActStepType.Observation:
        return <Eye className='w-4 h-4' />;
      case ReActStepType.FinalAnswer:
        return <CheckCircle className='w-4 h-4' />;
      default:
        return <Play className='w-4 h-4' />;
    }
  };

  const getStepColor = (stepType: ReActStepType) => {
    switch (stepType) {
      case ReActStepType.Thought:
        return 'primary';
      case ReActStepType.Action:
        return 'warning';
      case ReActStepType.Observation:
        return 'secondary';
      case ReActStepType.FinalAnswer:
        return 'success';
      default:
        return 'default';
    }
  };

  const getStepLabel = (stepType: ReActStepType) => {
    switch (stepType) {
      case ReActStepType.Thought:
        return 'Thought';
      case ReActStepType.Action:
        return 'Action';
      case ReActStepType.Observation:
        return 'Observation';
      case ReActStepType.FinalAnswer:
        return 'Final Answer';
      default:
        return 'Unknown';
    }
  };

  const formatExecutionTime = (ms?: number) => {
    if (!ms) {
      return 'N/A';
    }
    if (ms < 1000) {
      return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const groupStepsByIteration = (steps: ReActStep[]) => {
    const grouped = new Map<number, ReActStep[]>();
    steps.forEach(step => {
      const iteration = step.iteration || 0;
      if (!grouped.has(iteration)) {
        grouped.set(iteration, []);
      }
      grouped.get(iteration)!.push(step);
    });
    return Array.from(grouped.entries()).sort(([a], [b]) => a - b);
  };

  if (steps.length === 0) {
    return (
      <Card className={className}>
        <CardBody className='text-center py-8'>
          <div className='text-default-500'>
            <Brain className='w-12 h-12 mx-auto mb-2 opacity-50' />
            <p className='text-sm'>
              No ReAct steps recorded for this interaction
            </p>
            <p className='text-xs text-default-400 mt-1'>
              This might be a simple response that didn't require reasoning
              steps
            </p>
          </div>
        </CardBody>
      </Card>
    );
  }

  const iterationGroups = groupStepsByIteration(steps);

  return (
    <Card className={className}>
      <CardHeader className='pb-2'>
        <div className='flex items-center justify-between w-full'>
          <div className='flex items-center gap-2'>
            <Brain className='w-5 h-5 text-primary' />
            <h3 className='text-lg font-semibold'>ReAct Processing Steps</h3>
            <Chip size='sm' variant='flat' color='primary'>
              {steps.length} steps
            </Chip>
          </div>
          <Button
            size='sm'
            variant='flat'
            startContent={
              expandedSteps.size === steps.length ? (
                <ChevronDown className='w-4 h-4' />
              ) : (
                <ChevronRight className='w-4 h-4' />
              )
            }
            onPress={toggleAll}
          >
            {expandedSteps.size === steps.length
              ? 'Collapse All'
              : 'Expand All'}
          </Button>
        </div>
      </CardHeader>
      <CardBody className='pt-0'>
        <div className='space-y-4'>
          {iterationGroups.map(([iteration, iterationSteps]) => (
            <div key={iteration} className='space-y-3'>
              {iterationGroups.length > 1 && (
                <div className='flex items-center gap-2'>
                  <Divider className='flex-1' />
                  <Chip size='sm' variant='bordered' color='default'>
                    Iteration {iteration + 1}
                  </Chip>
                  <Divider className='flex-1' />
                </div>
              )}

              {iterationSteps.map((step, _stepIndex) => {
                const isExpanded = expandedSteps.has(step.id);
                const hasToolCall = step.toolCall && step.toolResult;

                return (
                  <Card
                    key={step.id}
                    className='bg-default-50 dark:bg-default-950/20 border-l-4'
                    style={{
                      borderLeftColor: `hsl(var(--heroui-${getStepColor(step.stepType)}))`,
                    }}
                  >
                    <CardHeader
                      className='pb-2 cursor-pointer hover:bg-default-100 dark:hover:bg-default-900/20 transition-colors'
                      onClick={() => toggleStep(step.id)}
                    >
                      <div className='flex items-center justify-between w-full'>
                        <div className='flex items-center gap-3'>
                          <div className='flex items-center gap-2'>
                            <Chip
                              size='sm'
                              color={getStepColor(step.stepType)}
                              variant='flat'
                              startContent={getStepIcon(step.stepType)}
                            >
                              {getStepLabel(step.stepType)}
                            </Chip>

                            {showTimestamps && (
                              <div className='text-xs text-default-500 flex items-center gap-1'>
                                <Clock className='w-3 h-3' />
                                {step.timestamp.toLocaleTimeString()}
                              </div>
                            )}

                            {showExecutionTimes && step.executionTime && (
                              <div className='text-xs text-default-500'>
                                ({formatExecutionTime(step.executionTime)})
                              </div>
                            )}

                            {hasToolCall && (
                              <Chip
                                size='sm'
                                variant='bordered'
                                color='secondary'
                              >
                                Tool: {step.toolCall!.name}
                              </Chip>
                            )}
                          </div>
                        </div>

                        <div className='flex items-center gap-2'>
                          {step.toolResult && !step.toolResult.success && (
                            <AlertCircle className='w-4 h-4 text-danger' />
                          )}
                          {isExpanded ? (
                            <ChevronDown className='w-4 h-4' />
                          ) : (
                            <ChevronRight className='w-4 h-4' />
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    {isExpanded && (
                      <CardBody className='pt-0'>
                        <div className='space-y-3'>
                          {/* Step Content */}
                          <div>
                            <label className='text-sm font-medium text-default-600 mb-2 block'>
                              {getStepLabel(step.stepType)} Content
                            </label>
                            <Card className='bg-white dark:bg-default-900'>
                              <CardBody>
                                <p className='text-sm whitespace-pre-wrap'>
                                  {step.content}
                                </p>
                              </CardBody>
                            </Card>
                          </div>

                          {/* Tool Call Details */}
                          {hasToolCall && (
                            <div className='space-y-3'>
                              <Accordion>
                                <AccordionItem
                                  key='tool-call'
                                  title={`Tool Call: ${step.toolCall!.name}`}
                                  startContent={<Zap className='w-4 h-4' />}
                                >
                                  <div className='space-y-3'>
                                    <div>
                                      <label className='text-sm font-medium text-default-600 mb-2 block'>
                                        Arguments
                                      </label>
                                      <Code className='text-xs whitespace-pre-wrap'>
                                        {JSON.stringify(
                                          step.toolCall!.arguments,
                                          null,
                                          2
                                        )}
                                      </Code>
                                    </div>

                                    <div>
                                      <label className='text-sm font-medium text-default-600 mb-2 block'>
                                        Result
                                      </label>
                                      <div className='flex items-center gap-2 mb-2'>
                                        <Chip
                                          size='sm'
                                          color={
                                            step.toolResult!.success
                                              ? 'success'
                                              : 'danger'
                                          }
                                          variant='flat'
                                        >
                                          {step.toolResult!.success
                                            ? 'Success'
                                            : 'Failed'}
                                        </Chip>
                                        <span className='text-xs text-default-500'>
                                          {formatExecutionTime(
                                            step.toolResult!.executionTime
                                          )}
                                        </span>
                                      </div>
                                      <Code className='text-xs whitespace-pre-wrap'>
                                        {JSON.stringify(
                                          step.toolResult!.data,
                                          null,
                                          2
                                        )}
                                      </Code>
                                      {step.toolResult!.message && (
                                        <div className='mt-2'>
                                          <p className='text-sm text-default-600'>
                                            {step.toolResult!.message}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </AccordionItem>
                              </Accordion>
                            </div>
                          )}
                        </div>
                      </CardBody>
                    )}
                  </Card>
                );
              })}
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
