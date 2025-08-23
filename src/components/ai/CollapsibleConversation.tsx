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
    <div className={`border border-divider rounded-lg ${className}`}>
      <Button
        variant='light'
        className='w-full justify-between p-3 h-auto'
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <span className='text-sm font-medium text-foreground-700'>{title}</span>
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
            <div className='p-3 pt-0 border-t border-divider'>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
