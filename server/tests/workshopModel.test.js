const mongoose = require('mongoose');
const Workshop = require('../models/Workshop');
const WorkshopEnrollment = require('../models/WorkshopEnrollment');

/**
 * T12.3: Unit Tests for Workshop & WorkshopEnrollment Mongoose Models
 * Validates Schema rules, default values, virtuals, and custom instance methods.
 */

// Helper validation function matching project test suite pattern
const validateModel = async (doc) => {
  try {
    await doc.validate();
    return undefined;
  } catch (error) {
    return error;
  }
};

describe('T12.3 - Workshop Model Unit Tests', () => {
  let dummyFacilitatorId;
  let dummySeekerId;

  beforeAll(() => {
    dummyFacilitatorId = new mongoose.Types.ObjectId();
    dummySeekerId = new mongoose.Types.ObjectId();
  });

  // Helper factory function to construct a base valid Workshop instance
  const makeValidWorkshop = (overrides = {}) => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    return new Workshop({
      title: 'Mindfulness and Anxiety Management Masterclass',
      description: 'A comprehensive interactive workshop helping individuals navigate stress and mental fatigue.',
      facilitator: dummyFacilitatorId,
      date: futureDate,
      time: '10:30 AM',
      durationMinutes: 90,
      mode: 'Online',
      locationOrLink: 'https://zoom.us/j/9876543210',
      capacity: 30,
      tags: ['mindfulness', 'anxiety', 'wellness'],
      ...overrides,
    });
  };

  describe('Workshop Schema Validation & Defaults', () => {
    it('should successfully validate a fully populated valid Workshop model', async () => {
      const workshop = makeValidWorkshop();
      const err = await validateModel(workshop);

      expect(err).toBeUndefined();
      expect(workshop.status).toBe('Scheduled');
      expect(workshop.enrolledCount).toBe(0);
      expect(workshop.durationMinutes).toBe(90);
      expect(workshop.mode).toBe('Online');
    });

    it('should fail validation when required fields are omitted', async () => {
      const emptyWorkshop = new Workshop({});
      const err = await validateModel(emptyWorkshop);

      expect(err).toBeDefined();
      expect(err.errors.title).toBeDefined();
      expect(err.errors.description).toBeDefined();
      expect(err.errors.facilitator).toBeDefined();
      expect(err.errors.date).toBeDefined();
      expect(err.errors.time).toBeDefined();
      expect(err.errors.locationOrLink).toBeDefined();
      expect(err.errors.capacity).toBeDefined();
    });

    it('should fail validation if title is too short or too long', async () => {
      const shortTitleWorkshop = makeValidWorkshop({ title: 'Test' });
      const shortErr = await validateModel(shortTitleWorkshop);

      expect(shortErr).toBeDefined();
      expect(shortErr.errors.title).toBeDefined();

      const longTitle = 'A'.repeat(151);
      const longTitleWorkshop = makeValidWorkshop({ title: longTitle });
      const longErr = await validateModel(longTitleWorkshop);

      expect(longErr).toBeDefined();
      expect(longErr.errors.title).toBeDefined();
    });

    it('should fail validation if description length is less than 20 characters', async () => {
      const invalidWorkshop = makeValidWorkshop({ description: 'Too short text' });
      const err = await validateModel(invalidWorkshop);

      expect(err).toBeDefined();
      expect(err.errors.description).toBeDefined();
    });

    it('should reject invalid time formats', async () => {
      const invalidTimeWorkshop = makeValidWorkshop({ time: '25:99 PM' });
      const err = await validateModel(invalidTimeWorkshop);

      expect(err).toBeDefined();
      expect(err.errors.time).toBeDefined();
    });

    it('should accept valid 12-hour formatted time strings', async () => {
      const validTime1 = makeValidWorkshop({ time: '09:00 AM' });
      const validTime2 = makeValidWorkshop({ time: '04:45 PM' });

      expect(await validateModel(validTime1)).toBeUndefined();
      expect(await validateModel(validTime2)).toBeUndefined();
    });

    it('should enforce enum restrictions on delivery mode', async () => {
      const invalidModeWorkshop = makeValidWorkshop({ mode: 'Metaverse' });
      const err = await validateModel(invalidModeWorkshop);

      expect(err).toBeDefined();
      expect(err.errors.mode).toBeDefined();
    });

    it('should enforce positive non-zero workshop capacity', async () => {
      const zeroCapacityWorkshop = makeValidWorkshop({ capacity: 0 });
      const err = await validateModel(zeroCapacityWorkshop);

      expect(err).toBeDefined();
      expect(err.errors.capacity).toBeDefined();
    });
  });

  describe('Workshop Virtual Properties', () => {
    it('should accurately compute seatsAvailable and isFull virtual properties', () => {
      const workshop = makeValidWorkshop({ capacity: 10, enrolledCount: 7 });

      expect(workshop.seatsAvailable).toBe(3);
      expect(workshop.isFull).toBe(false);
    });

    it('should return 0 seatsAvailable and true for isFull when workshop reaches max capacity', () => {
      const workshop = makeValidWorkshop({ capacity: 10, enrolledCount: 10 });

      expect(workshop.seatsAvailable).toBe(0);
      expect(workshop.isFull).toBe(true);
    });
  });

  describe('Workshop Instance Methods', () => {
    it('should increment enrollment count successfully', async () => {
      const workshop = makeValidWorkshop({ capacity: 5, enrolledCount: 2 });
      workshop.save = jest.fn().mockResolvedValue(workshop);

      await workshop.incrementEnrollment();

      expect(workshop.enrolledCount).toBe(3);
      expect(workshop.save).toHaveBeenCalledTimes(1);
    });

    it('should throw an error when trying to increment enrollment on a full workshop', async () => {
      const fullWorkshop = makeValidWorkshop({ capacity: 5, enrolledCount: 5 });
      fullWorkshop.save = jest.fn().mockResolvedValue(fullWorkshop);

      await expect(fullWorkshop.incrementEnrollment()).rejects.toThrow(
        'Cannot increment enrollment: Workshop has reached maximum capacity.'
      );
    });

    it('should decrement enrollment count correctly', async () => {
      const workshop = makeValidWorkshop({ capacity: 10, enrolledCount: 4 });
      workshop.save = jest.fn().mockResolvedValue(workshop);

      await workshop.decrementEnrollment();

      expect(workshop.enrolledCount).toBe(3);
      expect(workshop.save).toHaveBeenCalledTimes(1);
    });

    it('should not allow enrolledCount to drop below zero during decrement', async () => {
      const workshop = makeValidWorkshop({ capacity: 10, enrolledCount: 0 });
      workshop.save = jest.fn().mockResolvedValue(workshop);

      await workshop.decrementEnrollment();

      expect(workshop.enrolledCount).toBe(0);
    });

    it('should update status to Cancelled when cancelWorkshop is called', async () => {
      const workshop = makeValidWorkshop();
      workshop.save = jest.fn().mockResolvedValue(workshop);

      await workshop.cancelWorkshop();

      expect(workshop.status).toBe('Cancelled');
      expect(workshop.save).toHaveBeenCalledTimes(1);
    });
  });
});

describe('T12.3 - WorkshopEnrollment Model Unit Tests', () => {
  let dummyWorkshopId;
  let dummySeekerId;

  beforeAll(() => {
    dummyWorkshopId = new mongoose.Types.ObjectId();
    dummySeekerId = new mongoose.Types.ObjectId();
  });

  const makeValidEnrollment = (overrides = {}) => {
    return new WorkshopEnrollment({
      workshop: dummyWorkshopId,
      seeker: dummySeekerId,
      ...overrides,
    });
  };

  describe('WorkshopEnrollment Schema Validation & Defaults', () => {
    it('should validate a correct enrollment instance with defaults', async () => {
      const enrollment = makeValidEnrollment();
      const err = await validateModel(enrollment);

      expect(err).toBeUndefined();
      expect(enrollment.status).toBe('Enrolled');
      expect(enrollment.enrolledAt).toBeInstanceOf(Date);
      expect(enrollment.cancellationReason).toBeNull();
    });

    it('should fail validation when workshop or seeker ObjectIds are missing', async () => {
      const emptyEnrollment = new WorkshopEnrollment({});
      const err = await validateModel(emptyEnrollment);

      expect(err).toBeDefined();
      expect(err.errors.workshop).toBeDefined();
      expect(err.errors.seeker).toBeDefined();
    });

    it('should fail validation if status is not a valid enum value', async () => {
      const invalidStatusEnrollment = makeValidEnrollment({ status: 'Approved' });
      const err = await validateModel(invalidStatusEnrollment);

      expect(err).toBeDefined();
      expect(err.errors.status).toBeDefined();
    });
  });

  describe('WorkshopEnrollment Instance Methods', () => {
    it('should correctly mark enrollment as cancelled with reason and timestamp', async () => {
      const enrollment = makeValidEnrollment();
      enrollment.save = jest.fn().mockResolvedValue(enrollment);

      await enrollment.markCancelled('Personal Emergency');

      expect(enrollment.status).toBe('Cancelled');
      expect(enrollment.cancellationReason).toBe('Personal Emergency');
      expect(enrollment.cancelledAt).toBeInstanceOf(Date);
      expect(enrollment.save).toHaveBeenCalledTimes(1);
    });

    it('should correctly mark attendance as confirmed', async () => {
      const enrollment = makeValidEnrollment();
      enrollment.save = jest.fn().mockResolvedValue(enrollment);

      await enrollment.confirmAttendance();

      expect(enrollment.status).toBe('Attended');
      expect(enrollment.attendanceConfirmedAt).toBeInstanceOf(Date);
      expect(enrollment.save).toHaveBeenCalledTimes(1);
    });
  });
});