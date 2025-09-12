import { Card, CardBody, Button } from '@heroui/react';
import { Settings, Bot, ExternalLink } from 'lucide-react';

interface APIKeyMissingCardProps {
  onNavigateToSettings: () => void;
  className?: string;
}

/**
 * Card component shown when no API key is configured
 * Provides instructions and a button to navigate to Settings
 */
export function APIKeyMissingCard({
  onNavigateToSettings,
  className = '',
}: APIKeyMissingCardProps) {
  return (
    <div className={`flex-1 flex items-center justify-center p-6 ${className}`}>
      <Card className='max-w-lg'>
        <CardBody className='text-center py-8 px-6'>
          <div className='mb-6'>
            <Bot className='w-16 h-16 mx-auto mb-4 text-primary-500' />
            <h3 className='text-xl font-semibold mb-2 text-foreground'>
              AI Assistant Setup Required
            </h3>
            <p className='text-foreground-600 text-sm leading-relaxed'>
              To start chatting with Kira, you need to configure your AI API key
              first. This enables intelligent task management and personalized
              assistance.
            </p>
          </div>

          <div className='bg-content2 rounded-lg p-4 mb-6'>
            <h4 className='text-sm font-medium text-foreground mb-3 flex items-center justify-center gap-2'>
              <ExternalLink className='w-4 h-4' />
              Quick Setup Guide
            </h4>
            <ol className='text-xs text-foreground-600 space-y-2 list-decimal list-inside text-left'>
              <li>
                Visit{' '}
                <a
                  href='https://aistudio.google.com/app/apikey'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-primary-500 hover:text-primary-600 underline font-medium'
                >
                  Google AI Studio
                </a>
              </li>
              <li>Sign in with your Google account</li>
              <li>Click "Create API Key" and copy the generated key</li>
              <li>Return here and paste it in Settings</li>
            </ol>
          </div>

          <Button
            color='primary'
            size='lg'
            onPress={onNavigateToSettings}
            startContent={<Settings className='w-5 h-5' />}
            className='w-full'
          >
            Open Settings
          </Button>

          <p className='text-xs text-foreground-500 mt-4'>
            Your API key is stored locally and never shared with third parties
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
