import { Button, Tooltip } from '@heroui/react';
import { Copy, RotateCcw, Check } from 'lucide-react';
import { useClipboard } from '../../hooks/useClipboard';
import { useTranslation } from '../../hooks/useTranslation';

interface MessageActionsProps {
  content: string;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
  className?: string;
}

export function MessageActions({
  content,
  onRegenerate,
  className = '',
}: MessageActionsProps) {
  const { copied, copy } = useClipboard();
  const { t } = useTranslation();

  return (
    <div
      className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${className}`}
    >
      <Tooltip content={copied ? t('ai.actions.copied') : t('ai.actions.copy')}>
        <Button
          isIconOnly
          size='sm'
          variant='light'
          onPress={() => copy(content)}
          className='h-6 w-6 min-w-6'
        >
          {copied ? (
            <Check className='w-3 h-3 text-green-500' />
          ) : (
            <Copy className='w-3 h-3' />
          )}
        </Button>
      </Tooltip>
      {onRegenerate && (
        <Tooltip content={t('ai.actions.regenerate')}>
          <Button
            isIconOnly
            size='sm'
            variant='light'
            onPress={onRegenerate}
            className='h-6 w-6 min-w-6'
          >
            <RotateCcw className='w-3 h-3' />
          </Button>
        </Tooltip>
      )}
    </div>
  );
}
