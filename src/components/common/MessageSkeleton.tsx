import { motion } from 'framer-motion';

export function MessageSkeleton() {
  return (
    <div className='flex justify-start'>
      <div className='flex items-start gap-2 w-full'>
        {/* Avatar skeleton */}
        <div className='w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex-shrink-0 animate-pulse' />

        <div className='space-y-2 flex-1'>
          {/* Message content skeleton */}
          <div className='bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg space-y-2'>
            <motion.div
              className='h-3 bg-gray-200 dark:bg-gray-700 rounded w-full'
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <motion.div
              className='h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6'
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
            />
            <motion.div
              className='h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/5'
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
            />
            <motion.div
              className='h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4'
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
