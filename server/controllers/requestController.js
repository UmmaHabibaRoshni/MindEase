
const mongoose = require("mongoose");
const CrisisRequest = require("../models/CrisisRequest");

// POST /api/requests  (seeker only)
exports.createRequest = async (req, res) => {
  try {
    const { category, description, urgency } = req.body;

    if (!category || !description || !urgency) {
      return res
        .status(400)
        .json({ message: "category, description and urgency are required" });
    }

    const request = await CrisisRequest.create({
      seeker: req.user.id,
      category,
      description,
      urgency,
    });

    res.status(201).json({ message: "Request submitted", request });
  } catch (err) {
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ message: messages.join(", ") });
    }
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/requests/pending  (approved volunteer only)
exports.getPendingRequests = async (req, res) => {
  try {
    if (req.user.status !== "approved") {
      return res.status(403).json({ message: "Your account is not approved yet." });
    }

    // No seeker field: volunteer must not see seeker identity before accepting
    const requests = await CrisisRequest.find({ status: "pending" })
      .select("category description urgency createdAt")
      .sort({ createdAt: -1 });

    res.json({ requests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// PATCH /api/requests/:id/accept  (approved volunteer only)
exports.acceptRequest = async (req, res) => {
  try {
    if (req.user.status !== "approved") {
      return res.status(403).json({ message: "Your account is not approved yet." });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid request id" });
    }

    // Atomic: only succeeds if still pending, so two volunteers can't both win
    const request = await CrisisRequest.findOneAndUpdate(
      { _id: req.params.id, status: "pending" },
      { status: "accepted", acceptedBy: req.user.id },
      { new: true }
    );

    if (!request) {
      const exists = await CrisisRequest.exists({ _id: req.params.id });
      return res.status(exists ? 409 : 404).json({
        message: exists ? "Request already accepted" : "Request not found",
      });
    }

    res.json({ message: "Request accepted", request });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};