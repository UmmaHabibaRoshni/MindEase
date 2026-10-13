const mongoose = require("mongoose");

// must match REFERRAL_STATUSES in client/src/constants/requestOptions.js
const REFERRAL_STATUSES = ["pending", "in_progress", "resolved", "closed"];

// T14.1 - a referral is "answered" once the NGO moves it off pending.
const RESPONDED_STATUSES = REFERRAL_STATUSES.filter((s) => s !== "pending");

const NOTE_MAX = 1000;

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

    // ---- T14.1: the NGO's response -------------------------------------
    // What the NGO wrote back when it updated the status. Seekers never see
    // this; it is for the referring volunteer and the NGO's own record.
    note: {
      type: String,
      trim: true,
      maxlength: [NOTE_MAX, `A note cannot be longer than ${NOTE_MAX} characters.`],
      default: "",
    },
    // When the NGO first moved the referral off "pending". Set automatically.
    respondedAt: { type: Date, default: null },
    // Which NGO user answered.
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

referralSchema.index({ ngo: 1, status: 1 });

// Keep respondedAt in step with status so no controller has to remember to.
referralSchema.pre("validate", function stampResponse() {
  const answered = RESPONDED_STATUSES.includes(this.status);

  if (answered && !this.respondedAt) {
    this.respondedAt = new Date();
  }

  // Back to pending means the NGO has not answered after all.
  if (!answered) {
    this.respondedAt = null;
    this.respondedBy = null;
  }
});

module.exports = mongoose.model("Referral", referralSchema);
module.exports.REFERRAL_STATUSES = REFERRAL_STATUSES;
module.exports.RESPONDED_STATUSES = RESPONDED_STATUSES;
module.exports.NOTE_MAX = NOTE_MAX;
