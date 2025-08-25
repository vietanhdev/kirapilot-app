import React, { useState, useEffect } from 'react';
import {
  Card,
  CardBody,
  Button,
  Chip,
  Progress,
  Accordion,
  AccordionItem,
  Divider,
  Tooltip,
} from '@heroui/react';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Activity,
  AlertCircle,
  TrendingUp,
  Zap,
  Cloud,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface ModelStatusCardProps {
  modelType: 'local' | 'gemini';
  onRecovery?: () => void;
}

interface PerformanceMetrics {
  memory_usage_mb?: number;
  cpu_usage_percent?: number;
  [key: string]: unknown;
}

interface ErrorDiagnostics {
  timestamp: string;
  service_available: boolean;
  model_ready: boolean;
  recent_errors: unknown[];
  performance_metrics: PerformanceMetrics;
  system_health: 'healthy' | 'unhealthy' | 'unknown' | 'error' | 'initializing';
  recommendations?: string[];
}

interface HealthTest {
  passed: boolean;
  message: string;
  response_length?: number;
  error_type?: string;
  memory_usage_mb?: number;
  cpu_usage_percent?: number;
}

interface HealthReport {
  timestamp: string;
  overall_health: 'healthy' | 'unhealthy' | 'unknown';
  tests: {
    service_available?: HealthTest;
    model_ready?: HealthTest;
    generation_test?: HealthTest;
    resource_usage?: HealthTest;
  };
}

export const ModelStatusCard: React.FC<ModelStatusCardProps> = ({
  modelType,
  onRecovery,
}) => {
  const [diagnostics, setDiagnostics] = useState<ErrorDiagnostics | null>(null);
  const [healthReport, setHealthReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Fetch diagnostics data
  const fetchDiagnostics = async () => {
    if (modelType !== 'local') {
      return;
    }

    setLoading(true);
    try {
      const result = await invoke<ErrorDiagnostics>('get_error_diagnostics');
      setDiagnostics(result);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to fetch diagnostics:', error);
      setDiagnostics({
        timestamp: new Date().toISOString(),
        service_available: false,
        model_ready: false,
        recent_errors: [],
        performance_metrics: {},
        system_health: 'error',
        recommendations: [
          'Unable to fetch diagnostics - service may be unavailable',
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  // Run health test
  const runHealthTest = async () => {
    if (modelType !== 'local') {
      return;
    }

    setTesting(true);
    try {
      const result = await invoke<HealthReport>('test_model_health');
      setHealthReport(result);
    } catch (error) {
      console.error('Failed to run health test:', error);
      setHealthReport({
        timestamp: new Date().toISOString(),
        overall_health: 'unhealthy',
        tests: {
          service_available: {
            passed: false,
            message: 'Health test failed to execute',
          },
        },
      });
    } finally {
      setTesting(false);
    }
  };

  // Force model recovery
  const forceRecovery = async () => {
    setRecovering(true);
    try {
      await invoke<string>('force_model_recovery');

      // Wait a moment then refresh diagnostics
      setTimeout(() => {
        fetchDiagnostics();
        if (onRecovery) {
          onRecovery();
        }
      }, 1000);
    } catch (error) {
      console.error('Failed to force recovery:', error);
    } finally {
      setRecovering(false);
    }
  };

  // Auto-refresh diagnostics
  useEffect(() => {
    fetchDiagnostics();

    const interval = setInterval(fetchDiagnostics, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [modelType]);

  // Get status color and icon
  const getStatusDisplay = () => {
    if (modelType === 'gemini') {
      return {
        color: 'success' as const,
        icon: <Cloud className='w-4 h-4' />,
        text: 'Cloud Model Active',
        description: 'Using Gemini API for AI assistance',
      };
    }

    if (!diagnostics) {
      return {
        color: 'default' as const,
        icon: <RefreshCw className='w-4 h-4 animate-spin' />,
        text: 'Loading...',
        description: 'Checking local model status',
      };
    }

    switch (diagnostics.system_health) {
      case 'healthy':
        return {
          color: 'success' as const,
          icon: <CheckCircle className='w-4 h-4' />,
          text: 'Local Model Healthy',
          description: 'All systems operational',
        };
      case 'error':
        return {
          color: 'danger' as const,
          icon: <XCircle className='w-4 h-4' />,
          text: 'Local Model Error',
          description: 'Service unavailable',
        };
      case 'initializing':
        return {
          color: 'warning' as const,
          icon: <RefreshCw className='w-4 h-4 animate-spin' />,
          text: 'Initializing...',
          description: 'Model is starting up',
        };
      default:
        return {
          color: 'warning' as const,
          icon: <AlertTriangle className='w-4 h-4' />,
          text: 'Local Model Issues',
          description: 'Some issues detected',
        };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <Card className='w-full'>
      <CardBody className='p-4'>
        <div className='space-y-4'>
          {/* Main Status Display */}
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              {statusDisplay.icon}
              <div>
                <p className='text-sm font-medium text-foreground'>
                  {statusDisplay.text}
                </p>
                <p className='text-xs text-foreground-600'>
                  {statusDisplay.description}
                </p>
              </div>
            </div>
            <div className='flex items-center gap-2'>
              <Chip size='sm' color={statusDisplay.color} variant='flat'>
                {modelType === 'local' ? 'Local' : 'Cloud'}
              </Chip>
              {modelType === 'local' && (
                <Tooltip content='Refresh status'>
                  <Button
                    isIconOnly
                    size='sm'
                    variant='light'
                    onPress={fetchDiagnostics}
                    isLoading={loading}
                  >
                    <RefreshCw className='w-4 h-4' />
                  </Button>
                </Tooltip>
              )}
            </div>
          </div>

          {/* Local Model Diagnostics */}
          {modelType === 'local' && diagnostics && (
            <>
              <Divider />

              {/* Performance Metrics */}
              {diagnostics.performance_metrics &&
                Object.keys(diagnostics.performance_metrics).length > 0 && (
                  <div className='space-y-2'>
                    <div className='flex items-center gap-2'>
                      <Activity className='w-4 h-4' />
                      <span className='text-sm font-medium'>Performance</span>
                    </div>

                    {diagnostics.performance_metrics.memory_usage_mb && (
                      <div className='space-y-1'>
                        <div className='flex justify-between text-xs'>
                          <span>Memory Usage</span>
                          <span>
                            {diagnostics.performance_metrics.memory_usage_mb}MB
                          </span>
                        </div>
                        <Progress
                          value={
                            (diagnostics.performance_metrics.memory_usage_mb /
                              2048) *
                            100
                          }
                          color={
                            diagnostics.performance_metrics.memory_usage_mb >
                            1536
                              ? 'danger'
                              : 'success'
                          }
                          size='sm'
                        />
                      </div>
                    )}

                    {diagnostics.performance_metrics.cpu_usage_percent && (
                      <div className='space-y-1'>
                        <div className='flex justify-between text-xs'>
                          <span>CPU Usage</span>
                          <span>
                            {diagnostics.performance_metrics.cpu_usage_percent.toFixed(
                              1
                            )}
                            %
                          </span>
                        </div>
                        <Progress
                          value={
                            diagnostics.performance_metrics.cpu_usage_percent
                          }
                          color={
                            diagnostics.performance_metrics.cpu_usage_percent >
                            80
                              ? 'danger'
                              : 'success'
                          }
                          size='sm'
                        />
                      </div>
                    )}
                  </div>
                )}

              {/* Error Information and Recovery */}
              {(diagnostics.system_health === 'error' ||
                diagnostics.system_health === 'unhealthy') && (
                <div className='space-y-3'>
                  <div className='flex items-center gap-2 text-danger'>
                    <AlertCircle className='w-4 h-4' />
                    <span className='text-sm font-medium'>Issues Detected</span>
                  </div>

                  {diagnostics.recommendations &&
                    diagnostics.recommendations.length > 0 && (
                      <div className='bg-danger-50 dark:bg-danger-900/20 p-3 rounded-lg'>
                        <p className='text-xs font-medium text-danger mb-2'>
                          Recommendations:
                        </p>
                        <ul className='text-xs text-danger-700 dark:text-danger-300 space-y-1'>
                          {diagnostics.recommendations.map((rec, index) => (
                            <li key={index} className='flex items-start gap-2'>
                              <span className='text-danger mt-0.5'>•</span>
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                  <Button
                    size='sm'
                    color='danger'
                    variant='flat'
                    onPress={forceRecovery}
                    isLoading={recovering}
                    startContent={<Zap className='w-4 h-4' />}
                  >
                    Force Recovery
                  </Button>
                </div>
              )}

              {/* Advanced Diagnostics */}
              <Accordion variant='light' className='px-0'>
                <AccordionItem
                  key='diagnostics'
                  aria-label='Advanced Diagnostics'
                  title={
                    <div className='flex items-center gap-2'>
                      <TrendingUp className='w-4 h-4' />
                      <span className='text-sm'>Advanced Diagnostics</span>
                    </div>
                  }
                >
                  <div className='space-y-4'>
                    {/* Health Test */}
                    <div>
                      <div className='flex items-center justify-between mb-2'>
                        <span className='text-sm font-medium'>
                          System Health Test
                        </span>
                        <Button
                          size='sm'
                          variant='flat'
                          onPress={runHealthTest}
                          isLoading={testing}
                        >
                          Run Test
                        </Button>
                      </div>

                      {healthReport && (
                        <div className='space-y-2'>
                          <div className='flex items-center gap-2'>
                            {healthReport.overall_health === 'healthy' ? (
                              <CheckCircle className='w-4 h-4 text-success' />
                            ) : (
                              <XCircle className='w-4 h-4 text-danger' />
                            )}
                            <span className='text-sm capitalize'>
                              {healthReport.overall_health}
                            </span>
                          </div>

                          <div className='space-y-1'>
                            {Object.entries(healthReport.tests).map(
                              ([testName, test]) => (
                                <div
                                  key={testName}
                                  className='flex items-center justify-between text-xs'
                                >
                                  <span className='capitalize'>
                                    {testName.replace('_', ' ')}
                                  </span>
                                  <div className='flex items-center gap-1'>
                                    {test.passed ? (
                                      <CheckCircle className='w-3 h-3 text-success' />
                                    ) : (
                                      <XCircle className='w-3 h-3 text-danger' />
                                    )}
                                    <span
                                      className={
                                        test.passed
                                          ? 'text-success'
                                          : 'text-danger'
                                      }
                                    >
                                      {test.passed ? 'Pass' : 'Fail'}
                                    </span>
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* System Information */}
                    <div>
                      <span className='text-sm font-medium'>
                        System Information
                      </span>
                      <div className='mt-2 space-y-1 text-xs text-foreground-600'>
                        <div className='flex justify-between'>
                          <span>Service Available:</span>
                          <span
                            className={
                              diagnostics.service_available
                                ? 'text-success'
                                : 'text-danger'
                            }
                          >
                            {diagnostics.service_available ? 'Yes' : 'No'}
                          </span>
                        </div>
                        <div className='flex justify-between'>
                          <span>Model Ready:</span>
                          <span
                            className={
                              diagnostics.model_ready
                                ? 'text-success'
                                : 'text-danger'
                            }
                          >
                            {diagnostics.model_ready ? 'Yes' : 'No'}
                          </span>
                        </div>
                        {lastUpdate && (
                          <div className='flex justify-between'>
                            <span>Last Updated:</span>
                            <span>{lastUpdate.toLocaleTimeString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </AccordionItem>
              </Accordion>
            </>
          )}
        </div>
      </CardBody>
    </Card>
  );
};
