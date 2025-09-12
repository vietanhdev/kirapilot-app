import { useRef, useEffect, useState, useCallback } from 'react';

interface UseAutoScrollOptions {
  threshold?: number; // Distance from bottom to pause auto-scroll
  resumeDelay?: number; // Delay before resuming auto-scroll when user stops scrolling
}

interface UseAutoScrollReturn {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  isAutoScrollPaused: boolean;
  scrollToBottom: () => void;
  resumeAutoScroll: () => void;
}

export function useAutoScroll({
  threshold = 100,
  resumeDelay = 2000,
}: UseAutoScrollOptions = {}): UseAutoScrollReturn {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAutoScrollPaused, setIsAutoScrollPaused] = useState(false);
  const [userScrollTimeout, setUserScrollTimeout] =
    useState<NodeJS.Timeout | null>(null);
  const lastScrollTop = useRef(0);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current && !isAutoScrollPaused) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    }
  }, [isAutoScrollPaused]);

  const resumeAutoScroll = useCallback(() => {
    setIsAutoScrollPaused(false);
    scrollToBottom();
  }, [scrollToBottom]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < threshold;
    const isScrollingUp = scrollTop < lastScrollTop.current;

    lastScrollTop.current = scrollTop;

    // If user scrolls up or is not near bottom, pause auto-scroll
    if (isScrollingUp || !isNearBottom) {
      setIsAutoScrollPaused(true);

      // Clear existing timeout
      if (userScrollTimeout) {
        clearTimeout(userScrollTimeout);
      }

      // Set new timeout to resume auto-scroll
      const timeout = setTimeout(() => {
        setIsAutoScrollPaused(false);
      }, resumeDelay);

      setUserScrollTimeout(timeout);
    } else if (isNearBottom && !isScrollingUp) {
      // If user scrolls to bottom, resume auto-scroll immediately
      setIsAutoScrollPaused(false);
      if (userScrollTimeout) {
        clearTimeout(userScrollTimeout);
        setUserScrollTimeout(null);
      }
    }
  }, [threshold, resumeDelay, userScrollTimeout]);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) {
      return;
    }

    scrollElement.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
      if (userScrollTimeout) {
        clearTimeout(userScrollTimeout);
      }
    };
  }, [handleScroll, userScrollTimeout]);

  // Auto-scroll when content changes (but only if not paused)
  useEffect(() => {
    if (!isAutoScrollPaused) {
      scrollToBottom();
    }
  });

  return {
    scrollRef,
    isAutoScrollPaused,
    scrollToBottom,
    resumeAutoScroll,
  };
}
