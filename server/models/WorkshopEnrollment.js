const mongoose = require('mongoose');

/**
 * Workshop Enrollment Schema
 * Manages Seeker enrollments in Workshops with strict uniqueness constraints
 */
const workshopEnrollmentSchema = new mongoose.Schema(
  {
    workshop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workshop',
      required: [true, 'Workshop reference is required'],
      index: true,
    },
    seeker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Seeker (User) reference is required'],
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ['Enrolled', 'Attended', 'Cancelled', 'No-Show'],
        message: '{VALUE} is not a valid enrollment status',
      },
      default: 'Enrolled',
      index: true,
    },
    enrolledAt: {
      type: Date,
      default: Date.now,
    },
    cancellationReason: {
      type: String,
      default: null,
      trim: true,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    attendanceConfirmedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ST12.2 Requirement: Ensure strictly one enrollment record per seeker per workshop
workshopEnrollmentSchema.index({ workshop: 1, seeker: 1 }, { unique: true });

// Helper Method: Mark Enrollment as Cancelled
workshopEnrollmentSchema.methods.markCancelled = async function (reason = 'Cancelled by user') {
  this.status = 'Cancelled';
  this.cancellationReason = reason;
  this.cancelledAt = new Date();
  return await this.save();
};

// Helper Method: Mark Attendance Confirmed
workshopEnrollmentSchema.methods.confirmAttendance = async function () {
  this.status = 'Attended';
  this.attendanceConfirmedAt = new Date();
  return await this.save();
};

const WorkshopEnrollment = mongoose.model('WorkshopEnrollment', workshopEnrollmentSchema);
module.exports = WorkshopEnrollment;