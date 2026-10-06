const mongoose = require('mongoose');
const VolunteerAvailability = require('../models/VolunteerAvailability');

describe('Volunteer Availability Unit Tests (BL-10)', () => {
  it('should validate valid availability entries successfully', async () => {
    const validAvailability = new VolunteerAvailability({
      volunteer: new mongoose.Types.ObjectId(),
      dayOfWeek: 'Monday',
      startTime: '09:00',
      endTime: '17:00',
      isAvailable: true,
    });

    let err;
    try {
      await validAvailability.validate();
    } catch (error) {
      err = error;
    }

    expect(err).toBeUndefined();
  });

  it('should fail validation when required fields are missing', async () => {
    const invalidAvailability = new VolunteerAvailability({});

    let err;
    try {
      await invalidAvailability.validate();
    } catch (error) {
      err = error;
    }

    expect(err).toBeDefined();
    expect(err.errors.volunteer).toBeDefined();
    expect(err.errors.dayOfWeek).toBeDefined();
    expect(err.errors.startTime).toBeDefined();
    expect(err.errors.endTime).toBeDefined();
  });

  it('should fail validation for invalid dayOfWeek enum', async () => {
    const invalidDay = new VolunteerAvailability({
      volunteer: new mongoose.Types.ObjectId(),
      dayOfWeek: 'Funday',
      startTime: '09:00',
      endTime: '17:00',
    });

    let err;
    try {
      await invalidDay.validate();
    } catch (error) {
      err = error;
    }

    expect(err).toBeDefined();
    expect(err.errors.dayOfWeek).toBeDefined();
  });
});