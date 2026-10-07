const mongoose = require('mongoose');
const VolunteerAvailability = require('../models/VolunteerAvailability');
const { DAYS_OF_WEEK, TIME_PATTERN, toMinutes } = require('../config/availabilityOptions');

// T10.3 - unit tests for the availability model and constants (BL-10)

const validate = async (doc) => {
  try {
    await doc.validate();
    return undefined;
  } catch (error) {
    return error;
  }
};

describe('Volunteer Availability Unit Tests (BL-10)', () => {
  it('should validate a complete availability window successfully', async () => {
    const err = await validate(
      new VolunteerAvailability({
        volunteer: new mongoose.Types.ObjectId(),
        dayOfWeek: 'Monday',
        startTime: '09:00',
        endTime: '17:00',
        isAvailable: true,
      })
    );

    expect(err).toBeUndefined();
  });

  it('should require the volunteer reference', async () => {
    const err = await validate(new VolunteerAvailability({}));

    expect(err).toBeDefined();
    expect(err.errors.volunteer).toBeDefined();
  });

  // Regression: getMyAvailability creates the record with only the volunteer id,
  // so an empty window must be valid or that endpoint returns a 500.
  it('should allow a record with no window yet, defaulting to unavailable', async () => {
    const doc = new VolunteerAvailability({ volunteer: new mongoose.Types.ObjectId() });

    const err = await validate(doc);

    expect(err).toBeUndefined();
    expect(doc.isAvailable).toBe(false);
    expect(doc.dayOfWeek).toBeNull();
    expect(doc.startTime).toBeNull();
    expect(doc.endTime).toBeNull();
  });

  it('should reject an invalid dayOfWeek', async () => {
    const err = await validate(
      new VolunteerAvailability({
        volunteer: new mongoose.Types.ObjectId(),
        dayOfWeek: 'Funday',
        startTime: '09:00',
        endTime: '17:00',
      })
    );

    expect(err).toBeDefined();
    expect(err.errors.dayOfWeek).toBeDefined();
  });

  it.each(['9:00', '09:60', '24:00', 'morning', '0900'])(
    'should reject the malformed time %s',
    async (badTime) => {
      const err = await validate(
        new VolunteerAvailability({
          volunteer: new mongoose.Types.ObjectId(),
          dayOfWeek: 'Monday',
          startTime: badTime,
          endTime: '17:00',
        })
      );

      expect(err).toBeDefined();
      expect(err.errors.startTime).toBeDefined();
    }
  );

  it('should reject an endTime that is not after startTime', async () => {
    const err = await validate(
      new VolunteerAvailability({
        volunteer: new mongoose.Types.ObjectId(),
        dayOfWeek: 'Monday',
        startTime: '17:00',
        endTime: '09:00',
      })
    );

    expect(err).toBeDefined();
    expect(err.errors.endTime).toBeDefined();
  });

  it('should reject an endTime equal to startTime', async () => {
    const err = await validate(
      new VolunteerAvailability({
        volunteer: new mongoose.Types.ObjectId(),
        dayOfWeek: 'Monday',
        startTime: '09:00',
        endTime: '09:00',
      })
    );

    expect(err).toBeDefined();
    expect(err.errors.endTime).toBeDefined();
  });

  it('should not let a volunteer be available without a full window', async () => {
    const err = await validate(
      new VolunteerAvailability({
        volunteer: new mongoose.Types.ObjectId(),
        isAvailable: true,
      })
    );

    expect(err).toBeDefined();
    expect(err.errors.isAvailable).toBeDefined();
  });
});

describe('Availability constants (T10.2)', () => {
  it('should expose the seven days starting on Monday', () => {
    expect(DAYS_OF_WEEK).toHaveLength(7);
    expect(DAYS_OF_WEEK[0]).toBe('Monday');
    expect(DAYS_OF_WEEK).toContain('Sunday');
    expect(new Set(DAYS_OF_WEEK).size).toBe(7);
  });

  it('should match the model enum exactly', () => {
    expect(VolunteerAvailability.schema.path('dayOfWeek').enumValues).toEqual(DAYS_OF_WEEK);
  });

  it('should accept boundary times and reject out-of-range ones', () => {
    expect(TIME_PATTERN.test('00:00')).toBe(true);
    expect(TIME_PATTERN.test('23:59')).toBe(true);
    expect(TIME_PATTERN.test('24:00')).toBe(false);
  });

  it('should convert HH:MM to minutes since midnight', () => {
    expect(toMinutes('00:00')).toBe(0);
    expect(toMinutes('09:30')).toBe(570);
    expect(toMinutes('23:59')).toBe(1439);
  });
});
