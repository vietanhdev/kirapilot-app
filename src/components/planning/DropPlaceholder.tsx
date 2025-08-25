import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useEffect, useState, useRef } from 'react';

// Animation configuration constants
export const PLACEHOLDER_ANIMATION_CONFIG = {
  // Timing constants
  DURATION: {
    FADE_IN: 150,
    FADE_OUT: 100,
    POSITION_TRANSITION: 200,
    STAGGER_DELAY: 50,
  },
  // Easing curves
  EASING: {
    FADE_IN: 'easeOut',
    FADE_OUT: 'easeIn',
    POSITION: 'easeInOut',
    BOUNCE: [0.25, 0.46, 0.45, 0.94],
  },
  // Delays
  DELAY: {
    HOVER_SHOW: 100,
    HOVER_HIDE: 50,
    STAGGER_BASE: 25,
  },
  // Scale and opacity values
  SCALE: {
    INITIAL: 0.8,
    ANIMATE: 1,
    EXIT: 0.9,
  },
  OPACITY: {
    INITIAL: 0,
    ANIMATE: 1,
    EXIT: 0,
  },
} as const;

interface DropPlaceholderProps {
  isVisible: boolean;
  position: 'above' | 'below';
  taskId: string;
  columnId: string;
  className?: string;
  hoverDelay?: number;
  staggerIndex?: number;
  onAnimationComplete?: () => void;
  // Accessibility props
  isKeyboardNavigation?: boolean;
  currentDropPosition?: string;
  totalTasks?: number;
  taskIndex?: number;
}

export function DropPlaceholder({
  isVisible,
  position,
  taskId,
  columnId,
  className = '',
  hoverDelay = PLACEHOLDER_ANIMATION_CONFIG.DELAY.HOVER_SHOW,
  staggerIndex = 0,
  onAnimationComplete,
  isKeyboardNavigation = false,
  currentDropPosition,
  totalTasks = 0,
  taskIndex = 0,
}: DropPlaceholderProps) {
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [shouldShow, setShouldShow] = useState(false);
  const [, setIsAnimating] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Respect user's reduced motion preferences
  const shouldReduceMotion = useReducedMotion();

  // Handle hover delay logic for showing/hiding placeholders
  useEffect(() => {
    // Clear any existing timeouts
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    if (isVisible) {
      // Show placeholder after hover delay
      hoverTimeoutRef.current = setTimeout(
        () => {
          setShouldShow(true);
          setIsAnimating(true);
        },
        shouldReduceMotion ? 0 : hoverDelay
      );
    } else {
      // Hide placeholder with shorter delay
      hideTimeoutRef.current = setTimeout(
        () => {
          setShouldShow(false);
          setIsAnimating(true);
        },
        shouldReduceMotion ? 0 : PLACEHOLDER_ANIMATION_CONFIG.DELAY.HOVER_HIDE
      );
    }

    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [isVisible, hoverDelay, shouldReduceMotion]);

  // Calculate responsive width based on container
  useEffect(() => {
    if (!shouldShow) {
      return;
    }

    const updateWidth = () => {
      // Find the parent column container to calculate width
      const columnElement = document.querySelector(
        `[data-column-id="${columnId}"]`
      );
      if (columnElement) {
        const rect = columnElement.getBoundingClientRect();
        // Set width to match task cards with appropriate margins
        setContainerWidth(rect.width - 32); // Account for column padding
      } else {
        // Fallback to a reasonable default width
        setContainerWidth(320);
      }
    };

    updateWidth();

    // Update width on window resize
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [shouldShow, columnId]);

  // Calculate stagger delay for smooth sequential animations
  const staggerDelay = shouldReduceMotion
    ? 0
    : PLACEHOLDER_ANIMATION_CONFIG.DELAY.STAGGER_BASE + staggerIndex * 25; // 25ms stagger delay

  // Animation variants for smooth transitions
  const containerVariants = {
    initial: {
      opacity: PLACEHOLDER_ANIMATION_CONFIG.OPACITY.INITIAL,
      scaleX: PLACEHOLDER_ANIMATION_CONFIG.SCALE.INITIAL,
      height: 0,
      y: position === 'above' ? -10 : 10,
    },
    animate: {
      opacity: PLACEHOLDER_ANIMATION_CONFIG.OPACITY.ANIMATE,
      scaleX: PLACEHOLDER_ANIMATION_CONFIG.SCALE.ANIMATE,
      height: 'auto',
      y: 0,
      transition: {
        duration: shouldReduceMotion
          ? 0.1
          : PLACEHOLDER_ANIMATION_CONFIG.DURATION.FADE_IN / 1000,
        ease: PLACEHOLDER_ANIMATION_CONFIG.EASING.FADE_IN,
        delay: staggerDelay / 1000,
        when: 'beforeChildren',
        staggerChildren: shouldReduceMotion ? 0 : 0.02,
      },
    },
    exit: {
      opacity: PLACEHOLDER_ANIMATION_CONFIG.OPACITY.EXIT,
      scaleX: PLACEHOLDER_ANIMATION_CONFIG.SCALE.EXIT,
      height: 0,
      y: position === 'above' ? -5 : 5,
      transition: {
        duration: shouldReduceMotion
          ? 0.05
          : PLACEHOLDER_ANIMATION_CONFIG.DURATION.FADE_OUT / 1000,
        ease: PLACEHOLDER_ANIMATION_CONFIG.EASING.FADE_OUT,
        when: 'afterChildren',
      },
    },
    // Position transition variant for smooth movement
    positionTransition: {
      y: 0,
      transition: {
        duration: shouldReduceMotion
          ? 0.1
          : PLACEHOLDER_ANIMATION_CONFIG.DURATION.POSITION_TRANSITION / 1000,
        ease: PLACEHOLDER_ANIMATION_CONFIG.EASING.POSITION,
      },
    },
  };

  const lineVariants = {
    initial: {
      width: 0,
      opacity: 0,
    },
    animate: {
      width: '100%',
      opacity: 1,
      transition: {
        width: {
          duration: shouldReduceMotion
            ? 0.1
            : PLACEHOLDER_ANIMATION_CONFIG.DURATION.FADE_IN / 1000,
          ease: PLACEHOLDER_ANIMATION_CONFIG.EASING.FADE_IN,
          delay: shouldReduceMotion ? 0 : 0.05,
        },
        opacity: {
          duration: shouldReduceMotion ? 0.05 : 0.1,
          ease: 'easeOut' as const,
        },
      },
    },
    exit: {
      width: 0,
      opacity: 0,
      transition: {
        duration: shouldReduceMotion
          ? 0.05
          : (PLACEHOLDER_ANIMATION_CONFIG.DURATION.FADE_OUT * 0.7) / 1000,
        ease: PLACEHOLDER_ANIMATION_CONFIG.EASING.FADE_OUT,
      },
    },
  };

  const handleAnimationComplete = () => {
    setIsAnimating(false);
    onAnimationComplete?.();
  };

  // Generate accessible description for screen readers
  const getAccessibleDescription = () => {
    const positionText = position === 'above' ? 'before' : 'after';
    const positionNumber = position === 'above' ? taskIndex : taskIndex + 1;

    if (isKeyboardNavigation && currentDropPosition) {
      return `Drop position ${positionNumber} of ${totalTasks + 1} in ${columnId} column. ${currentDropPosition}`;
    }

    return `Drop zone ${positionText} task in ${columnId} column, position ${positionNumber}`;
  };

  // Generate ARIA live region content for dynamic announcements
  const getLiveRegionContent = () => {
    if (!isVisible || !isKeyboardNavigation) {
      return '';
    }

    const positionNumber = position === 'above' ? taskIndex : taskIndex + 1;
    return `Drop position ${positionNumber} of ${totalTasks + 1} available`;
  };

  return (
    <AnimatePresence mode='wait' onExitComplete={handleAnimationComplete}>
      {shouldShow && (
        <motion.div
          key={`placeholder-${taskId}-${position}`}
          variants={containerVariants}
          initial='initial'
          animate='animate'
          exit='exit'
          onAnimationComplete={handleAnimationComplete}
          className={`
                        flex justify-center items-center py-1
                        ${className}
                    `}
          style={{
            width: containerWidth ? `${containerWidth}px` : '100%',
          }}
          data-testid={`drop-placeholder-${taskId}-${position}`}
          // Enhanced accessibility attributes
          role='option'
          aria-label={getAccessibleDescription()}
          aria-live={isKeyboardNavigation ? 'assertive' : 'polite'}
          aria-atomic='true'
          aria-selected={isKeyboardNavigation && isVisible}
          aria-describedby={`placeholder-description-${taskId}-${position}`}
          // Keyboard navigation support
          tabIndex={isKeyboardNavigation ? 0 : -1}
          onKeyDown={e => {
            if (isKeyboardNavigation && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              // Trigger drop action - this would be handled by parent component
              onAnimationComplete?.();
            }
          }}
        >
          {/* Hidden description for screen readers */}
          <div
            id={`placeholder-description-${taskId}-${position}`}
            className='sr-only'
            aria-hidden='true'
          >
            {getLiveRegionContent()}
          </div>
          {/* Green line with enhanced animations */}
          <motion.div
            variants={lineVariants}
            className='relative'
            style={{
              height: '3px',
              maxWidth: '100%',
            }}
          >
            {/* Main green line with WCAG compliant contrast */}
            <div
              className='
                                h-full rounded-full
                                bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-600
                                dark:from-emerald-400 dark:via-emerald-300 dark:to-emerald-400
                            '
              style={{
                boxShadow: `
                                    0 0 8px rgba(5, 150, 105, 0.8),
                                    0 0 16px rgba(5, 150, 105, 0.4),
                                    0 0 24px rgba(5, 150, 105, 0.2)
                                `,
                // Ensure sufficient contrast for accessibility (WCAG AA: 4.5:1, AAA: 7:1)
                minHeight: '3px',
                // High contrast mode support
                border: '1px solid transparent',
                borderColor: 'var(--placeholder-border, transparent)',
              }}
              // High contrast mode detection
              onLoad={e => {
                const element = e.target as HTMLElement;
                if (window.matchMedia('(prefers-contrast: high)').matches) {
                  element.style.setProperty('--placeholder-border', '#000000');
                  element.style.backgroundColor = '#00AA00'; // High contrast green
                }
              }}
            />

            {/* Subtle pulse animation - disabled for reduced motion and high contrast */}
            {!shouldReduceMotion &&
              !window.matchMedia('(prefers-contrast: high)').matches && (
                <motion.div
                  className='
                                    absolute inset-0 rounded-full
                                    bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-600
                                    dark:from-emerald-400 dark:via-emerald-300 dark:to-emerald-400
                                '
                  animate={{
                    opacity: [0.7, 1, 0.7],
                    scale: [1, 1.05, 1],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  style={{
                    filter: 'blur(1px)',
                  }}
                />
              )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
