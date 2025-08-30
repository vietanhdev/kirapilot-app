import { useState } from 'react';
import { Button, Tooltip } from '@heroui/react';
import { ThumbsUp, ThumbsDown, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '../../hooks/useTranslation';

interface FeedbackRatingButtonsProps {
  conversationId: string;
  onFeedbackSubmit: (
    conversationId: string,
    rating: number,
    feedback?: string
  ) => void;
  className?: string;
  compact?: boolean;
}

export function FeedbackRatingButtons({
  conversationId,
  onFeedbackSubmit,
  className = '',
  compact = false,
}: FeedbackRatingButtonsProps) {
  const { t } = useTranslation();
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [showStars, setShowStars] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleQuickRating = (rating: number) => {
    setSelectedRating(rating);
    setIsSubmitted(true);
    onFeedbackSubmit(conversationId, rating);
  };

  const handleStarRating = (rating: number) => {
    setSelectedRating(rating);
    setIsSubmitted(true);
    onFeedbackSubmit(conversationId, rating);
    setShowStars(false);
  };

  const handleShowStars = () => {
    setShowStars(true);
  };

  if (isSubmitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`flex items-center gap-1 text-xs text-success-600 ${className}`}
      >
        <Star className='w-3 h-3 fill-current' />
        <span>
          {t('ai.feedback.thankYou')} ({selectedRating}/5)
        </span>
      </motion.div>
    );
  }

  if (compact) {
    return (
      <div
        className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${className}`}
      >
        <Tooltip content={t('ai.feedback.helpful')}>
          <Button
            isIconOnly
            size='sm'
            variant='light'
            onPress={() => handleQuickRating(5)}
            className='h-6 w-6 min-w-6 text-foreground-500 hover:text-success-500'
          >
            <ThumbsUp className='w-3 h-3' />
          </Button>
        </Tooltip>
        <Tooltip content={t('ai.feedback.notHelpful')}>
          <Button
            isIconOnly
            size='sm'
            variant='light'
            onPress={() => handleQuickRating(2)}
            className='h-6 w-6 min-w-6 text-foreground-500 hover:text-danger-500'
          >
            <ThumbsDown className='w-3 h-3' />
          </Button>
        </Tooltip>
        <Tooltip content={t('ai.feedback.rateDetailed')}>
          <Button
            isIconOnly
            size='sm'
            variant='light'
            onPress={handleShowStars}
            className='h-6 w-6 min-w-6 text-foreground-500 hover:text-warning-500'
          >
            <Star className='w-3 h-3' />
          </Button>
        </Tooltip>

        <AnimatePresence>
          {showStars && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className='flex items-center gap-1 ml-1'
            >
              {[1, 2, 3, 4, 5].map(rating => (
                <Button
                  key={rating}
                  isIconOnly
                  size='sm'
                  variant='light'
                  onPress={() => handleStarRating(rating)}
                  className='h-5 w-5 min-w-5 text-warning-400 hover:text-warning-500'
                >
                  <Star className='w-3 h-3' />
                </Button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className='text-xs text-foreground-600'>
        {t('ai.feedback.wasThisHelpful')}
      </span>
      <div className='flex items-center gap-1'>
        <Button
          size='sm'
          variant='flat'
          color='success'
          startContent={<ThumbsUp className='w-3 h-3' />}
          onPress={() => handleQuickRating(5)}
          className='h-7 px-2 text-xs'
        >
          {t('ai.feedback.yes')}
        </Button>
        <Button
          size='sm'
          variant='flat'
          color='danger'
          startContent={<ThumbsDown className='w-3 h-3' />}
          onPress={() => handleQuickRating(2)}
          className='h-7 px-2 text-xs'
        >
          {t('ai.feedback.no')}
        </Button>
        <Button
          size='sm'
          variant='flat'
          startContent={<Star className='w-3 h-3' />}
          onPress={handleShowStars}
          className='h-7 px-2 text-xs'
        >
          {t('ai.feedback.rate')}
        </Button>
      </div>

      <AnimatePresence>
        {showStars && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className='flex items-center gap-1 ml-2'
          >
            {[1, 2, 3, 4, 5].map(rating => (
              <Button
                key={rating}
                isIconOnly
                size='sm'
                variant='light'
                onPress={() => handleStarRating(rating)}
                className='h-6 w-6 min-w-6 text-warning-400 hover:text-warning-500 hover:scale-110 transition-transform'
              >
                <Star className='w-4 h-4' />
              </Button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
