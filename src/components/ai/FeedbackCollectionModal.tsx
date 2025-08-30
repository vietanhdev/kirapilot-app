import { useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Textarea,
  Chip,
  Card,
  CardBody,
} from '@heroui/react';
import { Star, MessageSquare, Lightbulb, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from '../../hooks/useTranslation';
import { UserFeedback, FeedbackCategory } from '../../types/aiLogging';

interface FeedbackCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  aiResponse: string;
  onSubmit: (feedback: UserFeedback) => void;
  initialRating?: number;
}

const FEEDBACK_CATEGORIES = [
  { key: 'helpfulness', icon: Lightbulb, color: 'primary' as const },
  { key: 'accuracy', icon: AlertCircle, color: 'success' as const },
  { key: 'clarity', icon: MessageSquare, color: 'secondary' as const },
  { key: 'speed', icon: Star, color: 'warning' as const },
  { key: 'personality', icon: Star, color: 'danger' as const },
];

export function FeedbackCollectionModal({
  isOpen,
  onClose,
  conversationId: _conversationId,
  aiResponse,
  onSubmit,
  initialRating = 0,
}: FeedbackCollectionModalProps) {
  const { t } = useTranslation();
  const [overallRating, setOverallRating] = useState(initialRating);
  const [categoryRatings, setCategoryRatings] = useState<
    Record<string, number>
  >({});
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCategoryRating = (category: string, rating: number) => {
    setCategoryRatings(prev => ({
      ...prev,
      [category]: rating,
    }));
  };

  const handleSubmit = async () => {
    if (overallRating === 0) {
      return;
    }

    setIsSubmitting(true);

    const categories: FeedbackCategory[] = Object.entries(categoryRatings).map(
      ([category, rating]) => ({
        category: category as FeedbackCategory['category'],
        rating,
      })
    );

    const feedback: UserFeedback = {
      rating: overallRating,
      comment: comment.trim() || undefined,
      categories,
      timestamp: new Date(),
    };

    try {
      await onSubmit(feedback);
      onClose();
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setOverallRating(initialRating);
    setCategoryRatings({});
    setComment('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size='2xl'
      scrollBehavior='inside'
      classNames={{
        base: 'max-h-[90vh]',
        body: 'py-6',
      }}
    >
      <ModalContent>
        <ModalHeader className='flex flex-col gap-1'>
          <h3 className='text-lg font-semibold'>
            {t('ai.feedback.modal.title')}
          </h3>
          <p className='text-sm text-foreground-600 font-normal'>
            {t('ai.feedback.modal.subtitle')}
          </p>
        </ModalHeader>

        <ModalBody>
          <div className='space-y-6'>
            {/* AI Response Preview */}
            <Card className='bg-content2'>
              <CardBody className='p-4'>
                <div className='flex items-start gap-3'>
                  <div className='w-8 h-8 rounded-full bg-gradient-to-r from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0'>
                    <Star className='w-4 h-4 text-white' />
                  </div>
                  <div className='flex-1'>
                    <p className='text-sm text-foreground-700 line-clamp-3'>
                      {aiResponse}
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Overall Rating */}
            <div className='space-y-3'>
              <h4 className='text-sm font-medium'>
                {t('ai.feedback.modal.overallRating')}
              </h4>
              <div className='flex items-center gap-2'>
                {[1, 2, 3, 4, 5].map(rating => (
                  <motion.button
                    key={rating}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setOverallRating(rating)}
                    className={`p-2 rounded-lg transition-colors ${
                      rating <= overallRating
                        ? 'text-warning-500 bg-warning-50 dark:bg-warning-900/20'
                        : 'text-foreground-400 hover:text-warning-400 hover:bg-content2'
                    }`}
                  >
                    <Star
                      className={`w-6 h-6 ${
                        rating <= overallRating ? 'fill-current' : ''
                      }`}
                    />
                  </motion.button>
                ))}
                <span className='ml-2 text-sm text-foreground-600'>
                  {overallRating > 0 && (
                    <>
                      {overallRating}/5 -{' '}
                      {t(
                        `ai.feedback.rating.${overallRating}` as keyof typeof t
                      )}
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Category Ratings */}
            <div className='space-y-4'>
              <h4 className='text-sm font-medium'>
                {t('ai.feedback.modal.categoryRatings')}
              </h4>
              <div className='grid grid-cols-1 gap-3'>
                {FEEDBACK_CATEGORIES.map(({ key, icon: Icon, color }) => (
                  <div
                    key={key}
                    className='flex items-center justify-between p-3 rounded-lg bg-content2'
                  >
                    <div className='flex items-center gap-3'>
                      <div
                        className={`p-2 rounded-lg bg-${color}-100 dark:bg-${color}-900/20`}
                      >
                        <Icon className={`w-4 h-4 text-${color}-600`} />
                      </div>
                      <div>
                        <p className='text-sm font-medium'>
                          {t(
                            `ai.feedback.category.${key}.title` as keyof typeof t
                          )}
                        </p>
                        <p className='text-xs text-foreground-600'>
                          {t(
                            `ai.feedback.category.${key}.description` as keyof typeof t
                          )}
                        </p>
                      </div>
                    </div>
                    <div className='flex items-center gap-1'>
                      {[1, 2, 3, 4, 5].map(rating => (
                        <button
                          key={rating}
                          onClick={() => handleCategoryRating(key, rating)}
                          className={`p-1 rounded transition-colors ${
                            rating <= (categoryRatings[key] || 0)
                              ? 'text-warning-500'
                              : 'text-foreground-300 hover:text-warning-400'
                          }`}
                        >
                          <Star
                            className={`w-3 h-3 ${
                              rating <= (categoryRatings[key] || 0)
                                ? 'fill-current'
                                : ''
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Comment */}
            <div className='space-y-3'>
              <h4 className='text-sm font-medium'>
                {t('ai.feedback.modal.additionalComments')}
              </h4>
              <Textarea
                value={comment}
                onValueChange={setComment}
                placeholder={t('ai.feedback.modal.commentPlaceholder')}
                minRows={3}
                maxRows={6}
                classNames={{
                  input: 'text-sm',
                }}
              />
            </div>

            {/* Quick Feedback Chips */}
            <div className='space-y-3'>
              <h4 className='text-sm font-medium'>
                {t('ai.feedback.modal.quickFeedback')}
              </h4>
              <div className='flex flex-wrap gap-2'>
                {[
                  'veryHelpful',
                  'couldBeImproved',
                  'tooSlow',
                  'perfectTiming',
                  'needsMoreDetail',
                  'tooVerbose',
                  'greatPersonality',
                  'tooFormal',
                ].map(feedbackType => (
                  <Chip
                    key={feedbackType}
                    variant='flat'
                    color='primary'
                    className='cursor-pointer hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors'
                    onClick={() => {
                      const currentComment = comment.trim();
                      const feedbackText = t(
                        `ai.feedback.quick.${feedbackType}` as keyof typeof t
                      );
                      const newComment = currentComment
                        ? `${currentComment}, ${feedbackText}`
                        : feedbackText;
                      setComment(newComment);
                    }}
                  >
                    {t(`ai.feedback.quick.${feedbackType}` as keyof typeof t)}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        </ModalBody>

        <ModalFooter>
          <Button
            variant='light'
            onPress={handleClose}
            isDisabled={isSubmitting}
          >
            {t('common.cancel')}
          </Button>
          <Button
            color='primary'
            onPress={handleSubmit}
            isLoading={isSubmitting}
            isDisabled={overallRating === 0}
          >
            {t('ai.feedback.modal.submit')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
