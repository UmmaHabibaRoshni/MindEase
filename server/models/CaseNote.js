const mongoose = require("mongoose");

const caseNoteSchema = new mongoose.Schema(
  {
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CaseAssignment",
      required: true,
      index: true,
    },
    psychologist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
  },
  { timestamps: true }
);

caseNoteSchema.index({ assignment: 1, createdAt: -1 });

module.exports = mongoose.model("CaseNote", caseNoteSchema);