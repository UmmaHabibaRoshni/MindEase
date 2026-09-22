
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
      enum: ['pending', 'approved', 'rejected'],
      default: function () {
        return this.role === 'seeker' ? 'approved' : 'pending';
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);