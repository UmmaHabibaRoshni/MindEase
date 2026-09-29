const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    request: { type: mongoose.Schema.Types.ObjectId, ref: "CrisisRequest", required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // encrypted payload, never store plaintext
    content: { type: String, required: true },
    iv: { type: String, required: true },
    tag: { type: String, required: true },
  },
  { timestamps: true }
);

messageSchema.index({ request: 1, createdAt: 1 });

module.exports = mongoose.model("Message", messageSchema);