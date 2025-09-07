import { useState, useEffect } from 'react';
import { Button, Card, CardBody, CardHeader, Chip } from '@heroui/react';
import {
  resetMessageLoadCircuitBreaker,
  resetAllCircuitBreakers,
  getCircuitBreakerStatus,
  isMessageLoadCircuitBreakerOpen,
  waitForCircuitBreakerReset,
} from '../../utils/circuitBreakerUtils';

interface CircuitBreakerDebuggerProps {
  onReset?: () => void;
}

interface CircuitBreakerStatus {
  failureCounts?: Record<string, number>;
  lastFailureTimes?: Record<string, number>;
}

export function CircuitBreakerDebugger({
  onReset,
}: CircuitBreakerDebuggerProps) {
  const [status, setStatus] = useState<CircuitBreakerStatus>({});
  const [isOpen, setIsOpen] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);

  const refreshStatus = () => {
    const currentStatus = getCircuitBreakerStatus();
    const circuitOpen = isMessageLoadCircuitBreakerOpen();

    setStatus(currentStatus);
    setIsOpen(circuitOpen);
  };

  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleResetMessageLoad = () => {
    resetMessageLoadCircuitBreaker();
    refreshStatus();
    onReset?.();
  };

  const handleResetAll = () => {
    resetAllCircuitBreakers();
    refreshStatus();
    onReset?.();
  };

  const handleWaitForReset = async () => {
    setIsWaiting(true);
    try {
      const success = await waitForCircuitBreakerReset();
      if (success) {
        refreshStatus();
        onReset?.();
      }
    } finally {
      setIsWaiting(false);
    }
  };

  const getTimeUntilReset = (lastFailure: number) => {
    if (!lastFailure) {
      return 0;
    }
    const timeoutMs = 30000; // 30 seconds
    const elapsed = Date.now() - lastFailure;
    const remaining = Math.max(0, timeoutMs - elapsed);
    return Math.ceil(remaining / 1000);
  };

  return (
    <Card className='w-full max-w-2xl'>
      <CardHeader className='flex gap-3'>
        <div className='flex flex-col'>
          <p className='text-md font-semibold'>Circuit Breaker Status</p>
          <p className='text-small text-default-500'>
            Debug tool for managing circuit breaker state
          </p>
        </div>
        <div className='ml-auto'>
          <Chip color={isOpen ? 'danger' : 'success'} variant='flat' size='sm'>
            {isOpen ? 'OPEN' : 'CLOSED'}
          </Chip>
        </div>
      </CardHeader>

      <CardBody className='gap-4'>
        {/* Status Information */}
        <div className='space-y-2'>
          <h4 className='text-sm font-medium'>Current Status</h4>
          <div className='text-sm space-y-1'>
            <p>
              Message Load Circuit:{' '}
              <span className={isOpen ? 'text-danger' : 'text-success'}>
                {isOpen ? 'OPEN' : 'CLOSED'}
              </span>
            </p>
            <p>Circuit Breaker Timeout: 30 seconds</p>
          </div>
        </div>

        {/* Failure Information */}
        {Object.keys(status.failureCounts || {}).length > 0 && (
          <div className='space-y-2'>
            <h4 className='text-sm font-medium'>Failure Counts</h4>
            <div className='text-xs space-y-1'>
              {Object.entries(status.failureCounts || {}).map(
                ([key, count]) => {
                  const lastFailure = status.lastFailureTimes?.[key] || 0;
                  const timeUntilReset = getTimeUntilReset(lastFailure);

                  return (
                    <div
                      key={key}
                      className='flex justify-between items-center'
                    >
                      <span className='font-mono'>{key}</span>
                      <div className='text-right'>
                        <span className='text-danger'>
                          {count as number} failures
                        </span>
                        {timeUntilReset > 0 && (
                          <div className='text-xs text-default-500'>
                            Resets in {timeUntilReset}s
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className='flex gap-2 flex-wrap'>
          <Button
            size='sm'
            color='primary'
            variant='flat'
            onClick={handleResetMessageLoad}
            disabled={isWaiting}
          >
            Reset Message Load
          </Button>

          <Button
            size='sm'
            color='warning'
            variant='flat'
            onClick={handleResetAll}
            disabled={isWaiting}
          >
            Reset All
          </Button>

          {isOpen && (
            <Button
              size='sm'
              color='secondary'
              variant='flat'
              onClick={handleWaitForReset}
              isLoading={isWaiting}
            >
              {isWaiting ? 'Waiting...' : 'Wait for Auto Reset'}
            </Button>
          )}

          <Button size='sm' variant='light' onClick={refreshStatus}>
            Refresh
          </Button>
        </div>

        {/* Help Text */}
        <div className='text-xs text-default-500 space-y-1'>
          <p>• Circuit breaker opens after 5 consecutive failures</p>
          <p>• Automatically resets after 30 seconds of no activity</p>
          <p>• Manual reset is immediate and safe to use</p>
          {isOpen && (
            <p className='text-warning'>
              • Circuit is currently blocking message_load operations
            </p>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
