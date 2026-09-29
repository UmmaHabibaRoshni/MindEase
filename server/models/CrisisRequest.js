const mongoose = require("mongoose");

// enum values must match client/src/constants/requestOptions.js
const CATEGORIES = [
  "mental_health",
  "abuse_violence",
  "legal_aid",
  "medical",
  "substance_use",
  "other",
];
const URGENCY_LEVELS = ["low", "medium", "high", "critical"];

const crisisRequestSchema = new mongoose.Schema(
  {
    seeker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    category: { type: String, enum: CATEGORIES, required: true },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 2000,
    },
    urgency: { type: String, enum: URGENCY_LEVELS, required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "referred", "closed"],
      default: "pending",
    },
    acceptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CrisisRequest", crisisRequestSchema);