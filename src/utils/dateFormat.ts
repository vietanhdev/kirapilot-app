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
 * Parse a date string according to the specified format with enhanced validation
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
 * Parse a partial date string and attempt to complete it intelligently
 */
export function parsePartialDate(
  dateString: string,
  format: DateFormat
): Date | null {
  if (!dateString.trim()) {
    return null;
  }

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  let day: number, month: number, year: number;

  switch (format) {
    case 'DD/MM/YYYY':
    case 'MM/DD/YYYY': {
      const parts = dateString.split('/');
      if (parts.length === 1) {
        // Just day provided
        const dayValue = parseInt(parts[0], 10);
        if (isNaN(dayValue) || dayValue < 1 || dayValue > 31) {
          return null;
        }

        if (format === 'DD/MM/YYYY') {
          day = dayValue;
          month = currentMonth;
        } else {
          month = dayValue;
          day = currentDay;
        }
        year = currentYear;
      } else if (parts.length === 2) {
        // Day and month provided
        const first = parseInt(parts[0], 10);
        const second = parseInt(parts[1], 10);
        if (isNaN(first) || isNaN(second)) {
          return null;
        }

        if (format === 'DD/MM/YYYY') {
          day = first;
          month = second;
        } else {
          month = first;
          day = second;
        }
        year = currentYear;
      } else {
        return parseDate(dateString, format);
      }
      break;
    }
    case 'YYYY-MM-DD': {
      const parts = dateString.split('-');
      if (parts.length === 1) {
        // Just year provided
        year = parseInt(parts[0], 10);
        if (isNaN(year) || year < 1900 || year > 2100) {
          return null;
        }
        month = currentMonth;
        day = currentDay;
      } else if (parts.length === 2) {
        // Year and month provided
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        if (isNaN(year) || isNaN(month)) {
          return null;
        }
        day = currentDay;
      } else {
        return parseDate(dateString, format);
      }
      break;
    }
    default:
      return null;
  }

  // Validate ranges
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

  // Check if the date is valid
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

/**
 * Validate if a date is within the specified range
 */
export function isDateInRange(
  date: Date,
  minDate?: Date,
  maxDate?: Date
): boolean {
  if (minDate && date < minDate) {
    return false;
  }
  if (maxDate && date > maxDate) {
    return false;
  }
  return true;
}

/**
 * Get relative date descriptions (today, tomorrow, yesterday, etc.)
 */
export function getRelativeDateDescription(date: Date): string | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  switch (diffDays) {
    case -1:
      return 'Yesterday';
    case 0:
      return 'Today';
    case 1:
      return 'Tomorrow';
    default:
      if (diffDays > 1 && diffDays <= 7) {
        return `In ${diffDays} days`;
      } else if (diffDays < -1 && diffDays >= -7) {
        return `${Math.abs(diffDays)} days ago`;
      }
      return null;
  }
}

/**
 * Format date with relative description when appropriate
 */
export function formatDateWithRelative(
  date: Date | string | null | undefined,
  format: DateFormat,
  showRelative: boolean = true
): string {
  if (!date) {
    return '';
  }

  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) {
    return '';
  }

  const formatted = formatDate(dateObj, format);

  if (showRelative) {
    const relative = getRelativeDateDescription(dateObj);
    if (relative) {
      return `${formatted} (${relative})`;
    }
  }

  return formatted;
}

/**
 * Smart date input suggestions based on partial input
 */
export function getDateSuggestions(
  partialInput: string,
  format: DateFormat,
  maxSuggestions: number = 5
): string[] {
  const suggestions: string[] = [];
  const today = new Date();

  // If input is empty, suggest common dates
  if (!partialInput.trim()) {
    suggestions.push(formatDate(today, format)); // Today

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    suggestions.push(formatDate(tomorrow, format)); // Tomorrow

    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    suggestions.push(formatDate(nextWeek, format)); // Next week

    return suggestions.slice(0, maxSuggestions);
  }

  // Try to parse partial input and suggest completions
  const partial = parsePartialDate(partialInput, format);
  if (partial) {
    suggestions.push(formatDate(partial, format));
  }

  // Add contextual suggestions based on input
  if (partialInput.toLowerCase().includes('tod')) {
    suggestions.push(formatDate(today, format));
  }
  if (partialInput.toLowerCase().includes('tom')) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    suggestions.push(formatDate(tomorrow, format));
  }
  if (partialInput.toLowerCase().includes('yes')) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    suggestions.push(formatDate(yesterday, format));
  }

  return [...new Set(suggestions)].slice(0, maxSuggestions);
}
