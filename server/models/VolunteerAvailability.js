const mongoose = require('mongoose');
const { DAYS_OF_WEEK, TIME_PATTERN, toMinutes } = require('../config/availabilityOptions');

// T10.1 - one availability record per volunteer (BL-10).
//
// The day/time window is optional on purpose: a volunteer can flip isAvailable
// on or off before they have picked a window, and getMyAvailability creates the
// record with nothing but the volunteer id. Requiring them made that create
// throw a ValidationError.
const volunteerAvailabilitySchema = new mongoose.Schema(
  {
    volunteer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    dayOfWeek: {
      type: String,
      enum: DAYS_OF_WEEK,
      default: null,
    },
    startTime: {
      type: String, // format: "09:00"
      default: null,
      validate: {
        validator: (v) => v === null || TIME_PATTERN.test(v),
        message: 'startTime must be in HH:MM 24-hour format.',
      },
    },
    endTime: {
      type: String, // format: "17:00"
      default: null,
      validate: {
        validator: (v) => v === null || TIME_PATTERN.test(v),
        message: 'endTime must be in HH:MM 24-hour format.',
      },
    },
    isAvailable: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// A window only makes sense if it ends after it starts, and a volunteer cannot
// be bookable without one.
volunteerAvailabilitySchema.pre('validate', function markInvalidWindow() {
  if (this.startTime && this.endTime && TIME_PATTERN.test(this.startTime) && TIME_PATTERN.test(this.endTime)) {
    if (toMinutes(this.endTime) <= toMinutes(this.startTime)) {
      this.invalidate('endTime', 'endTime must be later than startTime.');
    }
  }

  if (this.isAvailable && (!this.dayOfWeek || !this.startTime || !this.endTime)) {
    this.invalidate(
      'isAvailable',
      'A day, startTime and endTime are required before marking yourself available.'
    );
  }
});

module.exports = mongoose.model('VolunteerAvailability', volunteerAvailabilitySchema);
