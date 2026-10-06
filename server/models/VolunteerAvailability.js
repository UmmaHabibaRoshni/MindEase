const mongoose = require('mongoose');

const volunteerAvailabilitySchema = new mongoose.Schema(
  {
    volunteer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    dayOfWeek: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      required: true,
    },
    startTime: {
      type: String, // format: "09:00"
      required: true,
    },
    endTime: {
      type: String, // format: "17:00"
      required: true,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('VolunteerAvailability', volunteerAvailabilitySchema);