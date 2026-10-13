const mongoose = require('mongoose');

/**
 * Workshop Schema Definitions
 * Defines the complete structure for Facilitator-created Workshops
 */
const workshopSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Workshop title is required'],
      trim: true,
      minlength: [5, 'Workshop title must be at least 5 characters long'],
      maxlength: [150, 'Workshop title cannot exceed 150 characters'],
    },
    description: {
      type: String,
      required: [true, 'Workshop description is required'],
      trim: true,
      minlength: [20, 'Description must be at least 20 characters long'],
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    facilitator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Facilitator reference is required'],
      index: true,
    },
    date: {
      type: Date,
      required: [true, 'Workshop date is required'],
      validate: {
        validator: function (value) {
          // Allow existing records or new dates set in the present/future
          return this.isNew ? value >= new Date().setHours(0, 0, 0, 0) : true;
        },
        message: 'Workshop date cannot be in the past',
      },
    },
    time: {
      type: String,
      required: [true, 'Workshop start time is required'],
      trim: true,
      match: [
        /^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i,
        'Please provide time in valid 12-hour format (e.g., 10:30 AM or 02:15 PM)',
      ],
    },
    durationMinutes: {
      type: Number,
      default: 60,
      min: [15, 'Minimum workshop duration is 15 minutes'],
      max: [480, 'Maximum workshop duration is 480 minutes (8 hours)'],
    },
    mode: {
      type: String,
      required: [true, 'Workshop delivery mode is required'],
      enum: {
        values: ['Online', 'In-Person', 'Hybrid'],
        message: '{VALUE} is not a valid delivery mode. Must be Online, In-Person, or Hybrid',
      },
      default: 'Online',
    },
    locationOrLink: {
      type: String,
      required: [true, 'Meeting link or physical address is required'],
      trim: true,
    },
    capacity: {
      type: Number,
      required: [true, 'Workshop capacity limit is required'],
      min: [1, 'Capacity must be at least 1 participant'],
      max: [500, 'Capacity cannot exceed 500 participants'],
    },
    enrolledCount: {
      type: Number,
      default: 0,
      min: [0, 'Enrolled count cannot be negative'],
    },
    status: {
      type: String,
      enum: {
        values: ['Scheduled', 'Ongoing', 'Completed', 'Cancelled'],
        message: '{VALUE} is not a supported workshop status',
      },
      default: 'Scheduled',
      index: true,
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound Index for fast lookup on facilitator schedule
workshopSchema.index({ facilitator: 1, date: 1 });
workshopSchema.index({ status: 1, date: 1 });

// Virtual property to calculate available remaining seats
workshopSchema.virtual('seatsAvailable').get(function () {
  const available = this.capacity - this.enrolledCount;
  return available > 0 ? available : 0;
});

// Virtual property to check if workshop is full
workshopSchema.virtual('isFull').get(function () {
  return this.enrolledCount >= this.capacity;
});

// Instance Method: Increment Enrolled Count
workshopSchema.methods.incrementEnrollment = async function () {
  if (this.isFull) {
    throw new Error('Cannot increment enrollment: Workshop has reached maximum capacity.');
  }
  this.enrolledCount += 1;
  return await this.save();
};

// Instance Method: Decrement Enrolled Count
workshopSchema.methods.decrementEnrollment = async function () {
  if (this.enrolledCount <= 0) {
    this.enrolledCount = 0;
  } else {
    this.enrolledCount -= 1;
  }
  return await this.save();
};

// Instance Method: Cancel Workshop
workshopSchema.methods.cancelWorkshop = async function () {
  this.status = 'Cancelled';
  return await this.save();
};

const Workshop = mongoose.model('Workshop', workshopSchema);
module.exports = Workshop;