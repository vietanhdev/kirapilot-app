/**
 * Date formatting utilities with support for different date formats
 */

export type DateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';

/**
 * Format a date according to the specified format
 */
export function formatDate(
  date: Date | string | null | undefined,
  format: DateFormat
): string {
  if (!date) {
    return '';
  }

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return '';
  }

  const day = dateObj.getDate().toString().padStart(2, '0');
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const year = dateObj.getFullYear().toString();

  switch (format) {
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    default:
      return `${day}/${month}/${year}`;
  }
}

/**
 * Parse a date string according to the specified format
 */
export function parseDate(dateString: string, format: DateFormat): Date | null {
  if (!dateString.trim()) {
    return null;
  }

  let day: number, month: number, year: number;

  switch (format) {
    case 'DD/MM/YYYY': {
      const parts = dateString.split('/');
      if (parts.length !== 3) {
        return null;
      }
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
      break;
    }
    case 'MM/DD/YYYY': {
      const parts = dateString.split('/');
      if (parts.length !== 3) {
        return null;
      }
      month = parseInt(parts[0], 10);
      day = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
      break;
    }
    case 'YYYY-MM-DD': {
      const parts = dateString.split('-');
      if (parts.length !== 3) {
        return null;
      }
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
      break;
    }
    default:
      return null;
  }

  // Validate the parsed values
  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    return null;
  }
  if (day < 1 || day > 31) {
    return null;
  }
  if (month < 1 || month > 12) {
    return null;
  }
  if (year < 1900 || year > 2100) {
    return null;
  }

  const date = new Date(year, month - 1, day);

  // Check if the date is valid (handles cases like Feb 30)
  if (
    date.getDate() !== day ||
    date.getMonth() !== month - 1 ||
    date.getFullYear() !== year
  ) {
    return null;
  }

  return date;
}

/**
 * Get the input format pattern for HTML date inputs based on the date format
 */
export function getDateInputPattern(format: DateFormat): string {
  switch (format) {
    case 'DD/MM/YYYY':
      return 'dd/mm/yyyy';
    case 'MM/DD/YYYY':
      return 'mm/dd/yyyy';
    case 'YYYY-MM-DD':
      return 'yyyy-mm-dd';
    default:
      return 'dd/mm/yyyy';
  }
}

/**
 * Get placeholder text for date inputs
 */
export function getDatePlaceholder(format: DateFormat): string {
  switch (format) {
    case 'DD/MM/YYYY':
      return 'DD/MM/YYYY';
    case 'MM/DD/YYYY':
      return 'MM/DD/YYYY';
    case 'YYYY-MM-DD':
      return 'YYYY-MM-DD';
    default:
      return 'DD/MM/YYYY';
  }
}

/**
 * Convert a date to ISO string format for HTML date inputs
 */
export function dateToInputValue(
  date: Date | string | null | undefined
): string {
  if (!date) {
    return '';
  }

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return '';
  }

  return dateObj.toISOString().split('T')[0];
}

/**
 * Convert HTML date input value to Date object
 */
export function inputValueToDate(value: string): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}
