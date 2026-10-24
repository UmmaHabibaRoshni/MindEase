const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    phone: { type: String, trim: true },
    role: {
      type: String,
      enum: ['seeker', 'volunteer', 'psychologist', 'ngo', 'facilitator', 'admin'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'suspended'],
      default: function () {
        return this.role === 'seeker' ? 'approved' : 'pending';
      },
    },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    verifiedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: '' },
    // T16.1 - set when an admin suspends the account, cleared on reactivation
    suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    suspendedAt: { type: Date, default: null },
    suspensionReason: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);