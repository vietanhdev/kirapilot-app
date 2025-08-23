import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Badge, Tooltip } from '@heroui/react';
import { Bot, MessageCircle, Sparkles } from 'lucide-react';
import { useAI } from '../../contexts/AIContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { useTranslation } from '../../hooks/useTranslation';
import { ChatUI } from './ChatUI';

interface AIFloatingButtonProps {
  className?: string;
}

export function AIFloatingButton({ className = '' }: AIFloatingButtonProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const { isInitialized, suggestions, isLoading, error } = useAI();
  const { navigateTo } = useNavigation();
  const { t } = useTranslation();

  const activeSuggestions = suggestions.filter(
    s => !s.dismissedAt && !s.appliedAt
  );
  const hasNotifications = activeSuggestions.length > 0;

  const getButtonColor = () => {
    if (error) {
      return 'danger';
    }
    if (!isInitialized) {
      return 'warning';
    }
    if (hasNotifications) {
      return 'secondary';
    }
    return 'primary';
  };

  const getTooltipText = () => {
    if (error) {
      return t('ai.error');
    }
    if (!isInitialized) {
      return t('ai.setup');
    }
    if (hasNotifications) {
      return `${activeSuggestions.length} ${t('ai.suggestions')}`;
    }
    return t('ai.chat');
  };

  const handleToggleChat = () => {
    if (!isInitialized) {
      // Navigate to settings AI tab if AI is not initialized
      navigateTo('settings', { tab: 'ai' });
      return;
    }
    setIsChatOpen(!isChatOpen);
  };

  return (
    <>
      <Tooltip content={getTooltipText()} placement='left'>
        <div
          className={`fixed bottom-8 right-8 z-40 bg-primary-500 rounded-xl ${className}`}
        >
          <motion.div
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            transition={{
              duration: hasNotifications ? 2 : 0,
              repeat: hasNotifications ? Infinity : 0,
            }}
          >
            <Badge
              content={hasNotifications ? activeSuggestions.length : undefined}
              color='danger'
              size='sm'
              placement='top-right'
              className={hasNotifications ? '' : 'hidden'}
            >
              <Button
                isIconOnly
                color={getButtonColor()}
                size='lg'
                className='w-14 h-14 shadow-2xl'
                onPress={handleToggleChat}
                isLoading={isLoading && !isChatOpen}
              >
                <AnimatePresence mode='wait'>
                  {hasNotifications ? (
                    <motion.div
                      key='sparkles'
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0, rotate: 180 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Sparkles className='w-6 h-6' />
                    </motion.div>
                  ) : isChatOpen ? (
                    <motion.div
                      key='message'
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0, rotate: 180 }}
                      transition={{ duration: 0.3 }}
                    >
                      <MessageCircle className='w-6 h-6' />
                    </motion.div>
                  ) : (
                    <motion.div
                      key='bot'
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0, rotate: 180 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Bot className='w-6 h-6' />
                    </motion.div>
                  )}
                </AnimatePresence>
              </Button>
            </Badge>
          </motion.div>
        </div>
      </Tooltip>

      <ChatUI isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </>
  );
}
