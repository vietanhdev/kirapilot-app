import { useState, useEffect } from 'react';

interface ResponsiveColumnConfig {
  minWidth: number;
  maxWidth: number;
  gap: number;
  padding: number;
}

interface ColumnWidthResult {
  columnWidth: number;
  columnsPerView: number;
  shouldShowScrollbar: boolean;
}

const DEFAULT_CONFIG: ResponsiveColumnConfig = {
  minWidth: 280, // Minimum column width for mobile
  maxWidth: 400, // Maximum column width for large screens
  gap: 12, // Gap between columns (3 * 4px in Tailwind)
  padding: 24, // Container padding (6 * 4px on each side)
};

export function useResponsiveColumnWidth(
  totalColumns: number,
  config: Partial<ResponsiveColumnConfig> = {}
): ColumnWidthResult {
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Calculate available width for columns
  const availableWidth = windowWidth - finalConfig.padding * 2;

  // Calculate how many columns can fit at minimum width
  const maxColumnsAtMinWidth = Math.floor(
    (availableWidth + finalConfig.gap) /
      (finalConfig.minWidth + finalConfig.gap)
  );

  // Determine how many columns to show
  const columnsPerView = Math.min(totalColumns, maxColumnsAtMinWidth);

  // Calculate the actual column width
  let columnWidth: number;

  if (columnsPerView === 0) {
    columnWidth = finalConfig.minWidth;
  } else {
    // Calculate width based on available space
    const totalGapWidth = (columnsPerView - 1) * finalConfig.gap;
    const availableForColumns = availableWidth - totalGapWidth;
    const calculatedWidth = availableForColumns / columnsPerView;

    // Constrain between min and max width
    columnWidth = Math.max(
      finalConfig.minWidth,
      Math.min(finalConfig.maxWidth, calculatedWidth)
    );
  }

  // Determine if scrollbar should be shown
  const shouldShowScrollbar = totalColumns > columnsPerView;

  return {
    columnWidth: Math.floor(columnWidth),
    columnsPerView,
    shouldShowScrollbar,
  };
}

// Preset configurations for different use cases
export const COLUMN_WIDTH_PRESETS = {
  compact: {
    minWidth: 240,
    maxWidth: 320,
    gap: 8,
    padding: 16,
  },
  comfortable: {
    minWidth: 300,
    maxWidth: 420,
    gap: 16,
    padding: 32,
  },
  spacious: {
    minWidth: 350,
    maxWidth: 500,
    gap: 20,
    padding: 40,
  },
} as const;
