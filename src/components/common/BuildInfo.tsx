import React from 'react';
import { Card, CardBody, Chip } from '@heroui/react';
import { GitBranch, Calendar, Hash, Monitor } from 'lucide-react';
import {
  getBuildInfo,
  getDetailedVersion,
  getBuildDate,
} from '../../utils/version';

interface BuildInfoProps {
  variant?: 'compact' | 'detailed';
  className?: string;
}

export const BuildInfo: React.FC<BuildInfoProps> = ({
  variant = 'compact',
  className = '',
}) => {
  const buildInfo = getBuildInfo();

  if (variant === 'compact') {
    return (
      <Chip variant='flat' color='primary' size='sm' className={className}>
        {getDetailedVersion()}
      </Chip>
    );
  }

  return (
    <Card className={`bg-content2 ${className}`}>
      <CardBody className='space-y-4'>
        <div className='flex items-center justify-between'>
          <span className='text-foreground-600 flex items-center gap-2'>
            <Hash className='w-4 h-4' />
            Version
          </span>
          <span className='text-foreground font-mono'>{buildInfo.version}</span>
        </div>

        <div className='flex items-center justify-between'>
          <span className='text-foreground-600 flex items-center gap-2'>
            <Calendar className='w-4 h-4' />
            Build Date
          </span>
          <span className='text-foreground text-sm'>{getBuildDate()}</span>
        </div>

        <div className='flex items-center justify-between'>
          <span className='text-foreground-600 flex items-center gap-2'>
            <GitBranch className='w-4 h-4' />
            Git Branch
          </span>
          <span className='text-foreground font-mono text-sm'>
            {buildInfo.git.branch}
          </span>
        </div>

        <div className='flex items-center justify-between'>
          <span className='text-foreground-600 flex items-center gap-2'>
            <Hash className='w-4 h-4' />
            Git Hash
          </span>
          <div className='flex items-center gap-2'>
            <span className='text-foreground font-mono text-sm'>
              {buildInfo.git.shortHash}
            </span>
            {buildInfo.git.isDirty && (
              <Chip size='sm' color='warning' variant='flat'>
                Modified
              </Chip>
            )}
          </div>
        </div>

        {buildInfo.git.tag && (
          <div className='flex items-center justify-between'>
            <span className='text-foreground-600'>Git Tag</span>
            <Chip size='sm' color='success' variant='flat'>
              {buildInfo.git.tag}
            </Chip>
          </div>
        )}

        <div className='flex items-center justify-between'>
          <span className='text-foreground-600 flex items-center gap-2'>
            <Monitor className='w-4 h-4' />
            Platform
          </span>
          <span className='text-foreground text-sm'>
            {buildInfo.platform} ({buildInfo.arch})
          </span>
        </div>

        <div className='flex items-center justify-between'>
          <span className='text-foreground-600'>Environment</span>
          <Chip
            size='sm'
            color={
              buildInfo.environment === 'production' ? 'success' : 'warning'
            }
            variant='flat'
          >
            {buildInfo.environment}
          </Chip>
        </div>
      </CardBody>
    </Card>
  );
};
