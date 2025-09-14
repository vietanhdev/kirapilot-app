import {
  getWeekStartDate,
  getWeekEndDate,
  getWeekRange,
  getWeekIdentifier,
} from '../dateFormat';

describe('Week Utility Functions', () => {
  describe('getWeekStartDate', () => {
    it('should get week start for Monday-based week', () => {
      // Test with a Wednesday
      const date = new Date('2024-01-17T15:30:00.000Z'); // Wednesday
      const weekStartDay = 1; // Monday

      const result = getWeekStartDate(date, weekStartDay);

      expect(result.toISOString()).toBe('2024-01-15T00:00:00.000Z'); // Monday
      expect(result.getDay()).toBe(1); // Monday
    });

    it('should get week start for Sunday-based week', () => {
      // Test with a Wednesday
      const date = new Date('2024-01-17T15:30:00.000Z'); // Wednesday
      const weekStartDay = 0; // Sunday

      const result = getWeekStartDate(date, weekStartDay);

      expect(result.toISOString()).toBe('2024-01-14T00:00:00.000Z'); // Sunday
      expect(result.getDay()).toBe(0); // Sunday
    });

    it('should handle Monday when week starts on Monday', () => {
      const date = new Date('2024-01-15T10:00:00.000Z'); // Monday
      const weekStartDay = 1; // Monday

      const result = getWeekStartDate(date, weekStartDay);

      expect(result.toISOString()).toBe('2024-01-15T00:00:00.000Z'); // Same Monday
    });

    it('should handle Sunday when week starts on Sunday', () => {
      const date = new Date('2024-01-14T10:00:00.000Z'); // Sunday
      const weekStartDay = 0; // Sunday

      const result = getWeekStartDate(date, weekStartDay);

      expect(result.toISOString()).toBe('2024-01-14T00:00:00.000Z'); // Same Sunday
    });

    it('should handle Sunday when week starts on Monday', () => {
      const date = new Date('2024-01-14T10:00:00.000Z'); // Sunday
      const weekStartDay = 1; // Monday

      const result = getWeekStartDate(date, weekStartDay);

      expect(result.toISOString()).toBe('2024-01-08T00:00:00.000Z'); // Previous Monday
    });

    it('should handle Saturday when week starts on Sunday', () => {
      const date = new Date('2024-01-13T10:00:00.000Z'); // Saturday
      const weekStartDay = 0; // Sunday

      const result = getWeekStartDate(date, weekStartDay);

      expect(result.toISOString()).toBe('2024-01-07T00:00:00.000Z'); // Previous Sunday
    });

    it('should reset time to 00:00:00', () => {
      const date = new Date('2024-01-17T23:59:59.999Z'); // Wednesday late
      const weekStartDay = 1; // Monday

      const result = getWeekStartDate(date, weekStartDay);

      expect(result.getUTCHours()).toBe(0);
      expect(result.getUTCMinutes()).toBe(0);
      expect(result.getUTCSeconds()).toBe(0);
      expect(result.getUTCMilliseconds()).toBe(0);
    });
  });

  describe('getWeekEndDate', () => {
    it('should get week end for Monday-based week', () => {
      const date = new Date('2024-01-17T15:30:00.000Z'); // Wednesday
      const weekStartDay = 1; // Monday

      const result = getWeekEndDate(date, weekStartDay);

      expect(result.toISOString()).toBe('2024-01-21T23:59:59.999Z'); // Sunday
      expect(result.getUTCDay()).toBe(0); // Sunday
    });

    it('should get week end for Sunday-based week', () => {
      const date = new Date('2024-01-17T15:30:00.000Z'); // Wednesday
      const weekStartDay = 0; // Sunday

      const result = getWeekEndDate(date, weekStartDay);

      expect(result.toISOString()).toBe('2024-01-20T23:59:59.999Z'); // Saturday
      expect(result.getUTCDay()).toBe(6); // Saturday
    });

    it('should set time to 23:59:59.999', () => {
      const date = new Date('2024-01-17T00:00:00.000Z'); // Wednesday early
      const weekStartDay = 1; // Monday

      const result = getWeekEndDate(date, weekStartDay);

      expect(result.getUTCHours()).toBe(23);
      expect(result.getUTCMinutes()).toBe(59);
      expect(result.getUTCSeconds()).toBe(59);
      expect(result.getUTCMilliseconds()).toBe(999);
    });

    it('should handle month boundaries correctly', () => {
      const date = new Date('2024-01-31T12:00:00.000Z'); // Wednesday, end of January
      const weekStartDay = 1; // Monday

      const result = getWeekEndDate(date, weekStartDay);

      expect(result.toISOString()).toBe('2024-02-04T23:59:59.999Z'); // Sunday in February
    });

    it('should handle year boundaries correctly', () => {
      const date = new Date('2023-12-31T12:00:00.000Z'); // Sunday, end of year
      const weekStartDay = 1; // Monday

      const result = getWeekEndDate(date, weekStartDay);

      expect(result.toISOString()).toBe('2023-12-31T23:59:59.999Z'); // Same Sunday
    });
  });

  describe('getWeekRange', () => {
    it('should return correct week range for Monday-based week', () => {
      const date = new Date('2024-01-17T15:30:00.000Z'); // Wednesday
      const weekStartDay = 1; // Monday

      const result = getWeekRange(date, weekStartDay);

      expect(result.weekStart.toISOString()).toBe('2024-01-15T00:00:00.000Z'); // Monday
      expect(result.weekEnd.toISOString()).toBe('2024-01-21T23:59:59.999Z'); // Sunday
    });

    it('should return correct week range for Sunday-based week', () => {
      const date = new Date('2024-01-17T15:30:00.000Z'); // Wednesday
      const weekStartDay = 0; // Sunday

      const result = getWeekRange(date, weekStartDay);

      expect(result.weekStart.toISOString()).toBe('2024-01-14T00:00:00.000Z'); // Sunday
      expect(result.weekEnd.toISOString()).toBe('2024-01-20T23:59:59.999Z'); // Saturday
    });

    it('should return a 7-day range', () => {
      const date = new Date('2024-01-17T15:30:00.000Z');
      const weekStartDay = 1;

      const result = getWeekRange(date, weekStartDay);

      const diffMs = result.weekEnd.getTime() - result.weekStart.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      // Should be just under 7 days (6 days, 23 hours, 59 minutes, 59.999 seconds)
      expect(diffDays).toBeCloseTo(6.999999988, 6);
    });
  });

  describe('getWeekIdentifier', () => {
    it('should generate consistent identifier for same week (Monday start)', () => {
      const monday = new Date('2024-01-15T08:00:00.000Z');
      const wednesday = new Date('2024-01-17T15:30:00.000Z');
      const sunday = new Date('2024-01-21T20:00:00.000Z');
      const weekStartDay = 1; // Monday

      const mondayId = getWeekIdentifier(monday, weekStartDay);
      const wednesdayId = getWeekIdentifier(wednesday, weekStartDay);
      const sundayId = getWeekIdentifier(sunday, weekStartDay);

      expect(mondayId).toBe('2024-01-15');
      expect(wednesdayId).toBe('2024-01-15');
      expect(sundayId).toBe('2024-01-15');
    });

    it('should generate consistent identifier for same week (Sunday start)', () => {
      const sunday = new Date('2024-01-14T08:00:00.000Z');
      const wednesday = new Date('2024-01-17T15:30:00.000Z');
      const saturday = new Date('2024-01-20T20:00:00.000Z');
      const weekStartDay = 0; // Sunday

      const sundayId = getWeekIdentifier(sunday, weekStartDay);
      const wednesdayId = getWeekIdentifier(wednesday, weekStartDay);
      const saturdayId = getWeekIdentifier(saturday, weekStartDay);

      expect(sundayId).toBe('2024-01-14');
      expect(wednesdayId).toBe('2024-01-14');
      expect(saturdayId).toBe('2024-01-14');
    });

    it('should generate different identifiers for different weeks', () => {
      const week1 = new Date('2024-01-17T12:00:00.000Z'); // Wednesday week 1
      const week2 = new Date('2024-01-24T12:00:00.000Z'); // Wednesday week 2
      const weekStartDay = 1; // Monday

      const week1Id = getWeekIdentifier(week1, weekStartDay);
      const week2Id = getWeekIdentifier(week2, weekStartDay);

      expect(week1Id).toBe('2024-01-15');
      expect(week2Id).toBe('2024-01-22');
      expect(week1Id).not.toBe(week2Id);
    });

    it('should use YYYY-MM-DD format', () => {
      const date = new Date('2024-01-17T12:00:00.000Z');
      const weekStartDay = 1;

      const identifier = getWeekIdentifier(date, weekStartDay);

      expect(identifier).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(identifier).toBe('2024-01-15');
    });

    it('should handle edge cases around month boundaries', () => {
      // Test week that spans January-February boundary
      const dateInWeek = new Date('2024-01-31T12:00:00.000Z'); // Wednesday
      const weekStartDay = 1; // Monday

      const identifier = getWeekIdentifier(dateInWeek, weekStartDay);

      expect(identifier).toBe('2024-01-29'); // Monday of that week
    });

    it('should handle edge cases around year boundaries', () => {
      // Test week that spans 2023-2024 boundary
      const dateInWeek = new Date('2024-01-02T12:00:00.000Z'); // Tuesday
      const weekStartDay = 1; // Monday

      const identifier = getWeekIdentifier(dateInWeek, weekStartDay);

      expect(identifier).toBe('2024-01-01'); // Monday of that week
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle leap year February correctly', () => {
      const date = new Date('2024-02-29T12:00:00.000Z'); // Leap day (Thursday)
      const weekStartDay = 1; // Monday

      const range = getWeekRange(date, weekStartDay);

      expect(range.weekStart.toISOString()).toBe('2024-02-26T00:00:00.000Z'); // Monday
      expect(range.weekEnd.toISOString()).toBe('2024-03-03T23:59:59.999Z'); // Sunday
    });

    it('should handle different timezones consistently', () => {
      // Create dates in different ways to test consistency
      const date1 = new Date('2024-01-17T00:00:00.000Z');
      const date2 = new Date('2024-01-17T23:59:59.999Z');
      const weekStartDay = 1;

      const range1 = getWeekRange(date1, weekStartDay);
      const range2 = getWeekRange(date2, weekStartDay);

      expect(range1.weekStart.toISOString()).toBe(
        range2.weekStart.toISOString()
      );
      expect(range1.weekEnd.toISOString()).toBe(range2.weekEnd.toISOString());
    });

    it('should handle very early and late dates', () => {
      const earlyDate = new Date('1900-01-01T12:00:00.000Z');
      const lateDate = new Date('2099-12-31T12:00:00.000Z');
      const weekStartDay = 1;

      expect(() => getWeekRange(earlyDate, weekStartDay)).not.toThrow();
      expect(() => getWeekRange(lateDate, weekStartDay)).not.toThrow();

      const earlyRange = getWeekRange(earlyDate, weekStartDay);
      const lateRange = getWeekRange(lateDate, weekStartDay);

      expect(earlyRange.weekStart).toBeInstanceOf(Date);
      expect(earlyRange.weekEnd).toBeInstanceOf(Date);
      expect(lateRange.weekStart).toBeInstanceOf(Date);
      expect(lateRange.weekEnd).toBeInstanceOf(Date);
    });
  });
});
