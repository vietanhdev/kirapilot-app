import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@heroui/react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface CollapsibleConversationProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  className?: string;
}

export function CollapsibleConversation({
  title,
  children,
  defaultExpanded = true,
  className = '',
}: CollapsibleConversationProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div
      className={`border border-gray-200 dark:border-gray-700 rounded-lg ${className}`}
    >
      <Button
        variant='light'
        className='w-full justify-between p-3 h-auto'
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
          {title}
        </span>
        {isExpanded ? (
          <ChevronUp className='w-4 h-4' />
        ) : (
          <ChevronDown className='w-4 h-4' />
        )}
      </Button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className='overflow-hidden'
          >
            <div className='p-3 pt-0 border-t border-gray-200 dark:border-gray-700'>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
