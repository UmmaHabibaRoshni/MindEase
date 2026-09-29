
const mongoose = require('mongoose');

// must match CATEGORIES in CrisisRequest.js and client/src/constants/requestOptions.js
const CATEGORIES = [
  'mental_health',
  'abuse_violence',
  'legal_aid',
  'medical',
  'substance_use',
  'other',
];

const ngoSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    organizationName: { type: String, required: true, trim: true },
    registrationNumber: { type: String, required: true, unique: true, trim: true },
    contactPhone: { type: String, required: true, trim: true },
    contactEmail: { type: String, lowercase: true, trim: true },
    address: { type: String, required: true, trim: true },
    categories: [{ type: String, enum: CATEGORIES }],
  },
  { timestamps: true }
);

ngoSchema.index({ categories: 1 });

module.exports = mongoose.model('Ngo', ngoSchema);