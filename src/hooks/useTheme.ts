import { useEffect, useState } from 'react';
import { useUserPreferences } from './useUserPreferences';

export type ResolvedTheme = 'light' | 'dark';

export const useTheme = () => {
  const { theme: userTheme, updatePreference } = useUserPreferences();
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('dark');
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>('dark');

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    // Set initial system theme
    setSystemTheme(mediaQuery.matches ? 'dark' : 'light');

    // Listen for changes
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Update resolved theme when user theme or system theme changes
  useEffect(() => {
    let newResolvedTheme: ResolvedTheme;

    if (userTheme === 'auto') {
      newResolvedTheme = systemTheme;
    } else {
      newResolvedTheme = userTheme as ResolvedTheme;
    }

    setResolvedTheme(newResolvedTheme);

    // Update document class for Tailwind
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(newResolvedTheme);

    // Update data attribute for HeroUI
    document.documentElement.setAttribute('data-theme', newResolvedTheme);
  }, [userTheme, systemTheme]);

  const setTheme = (theme: 'light' | 'dark' | 'auto') => {
    updatePreference('theme', theme);
  };

  return {
    theme: userTheme,
    resolvedTheme,
    systemTheme,
    setTheme,
    isDark: resolvedTheme === 'dark',
    isLight: resolvedTheme === 'light',
    isAuto: userTheme === 'auto',
  };
};
