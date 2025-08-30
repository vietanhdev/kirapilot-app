import { useState, useEffect } from 'react';

export interface ResponsiveConfig {
  maxVisibleActions: number;
  compact: boolean;
  buttonSize: 'sm' | 'md' | 'lg';
}

export const useResponsiveActions = () => {
  const [config, setConfig] = useState<ResponsiveConfig>({
    maxVisibleActions: 5,
    compact: false,
    buttonSize: 'md',
  });

  useEffect(() => {
    const updateConfig = () => {
      const width = window.innerWidth;

      if (width < 640) {
        // Mobile
        setConfig({
          maxVisibleActions: 2,
          compact: true,
          buttonSize: 'sm',
        });
      } else if (width < 768) {
        // Small tablet
        setConfig({
          maxVisibleActions: 3,
          compact: true,
          buttonSize: 'sm',
        });
      } else if (width < 1024) {
        // Tablet
        setConfig({
          maxVisibleActions: 4,
          compact: false,
          buttonSize: 'md',
        });
      } else {
        // Desktop
        setConfig({
          maxVisibleActions: 5,
          compact: false,
          buttonSize: 'md',
        });
      }
    };

    // Initial setup
    updateConfig();

    // Listen for window resize
    window.addEventListener('resize', updateConfig);

    return () => {
      window.removeEventListener('resize', updateConfig);
    };
  }, []);

  return config;
};
