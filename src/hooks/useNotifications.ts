import { useEffect } from 'react';
import { useTranslation } from './useTranslation';
import { timerNotifications } from '../services/notifications/TimerNotifications';

/**
 * Hook to initialize notifications with translation support
 */
export const useNotifications = () => {
  const { t } = useTranslation();

  useEffect(() => {
    // Set translation function for timer notifications
    timerNotifications.setTranslationFunction(t);
  }, [t]);

  return {
    timerNotifications,
  };
};
