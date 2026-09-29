const mongoose = require("mongoose");

// must match REFERRAL_STATUSES in client/src/constants/requestOptions.js
const REFERRAL_STATUSES = ["pending", "in_progress", "resolved", "closed"];

const referralSchema = new mongoose.Schema(
  {
    request: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CrisisRequest",
      required: true,
      unique: true, // one referral per request
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    ngo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ngo",
      required: true,
    },
    consentGiven: { type: Boolean, required: true },
    consentAt: { type: Date, required: true },
    status: { type: String, enum: REFERRAL_STATUSES, default: "pending" },
  },
  { timestamps: true }
);

referralSchema.index({ ngo: 1, status: 1 });

module.exports = mongoose.model("Referral", referralSchema);
module.exports.REFERRAL_STATUSES = REFERRAL_STATUSES;