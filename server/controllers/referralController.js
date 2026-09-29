const mongoose = require("mongoose");
const CrisisRequest = require("../models/CrisisRequest");
const Ngo = require("../models/Ngo");
const User = require("../models/User");
const Referral = require("../models/Referral");
const { REFERRAL_STATUSES } = Referral;

const approvedOnly = (req, res) => {
  if (req.user.status !== "approved") {
    res.status(403).json({ message: "Your account is not approved yet." });
    return false;
  }
  return true;
};

// POST /api/referrals  (volunteer) body: { requestId, ngoId, consent: true }
exports.createReferral = async (req, res) => {
  try {
    if (!approvedOnly(req, res)) return;
    const { requestId, ngoId, consent } = req.body;

    if (consent !== true) {
      return res.status(400).json({ message: "Seeker consent is required" });
    }
    if (!mongoose.isValidObjectId(requestId) || !mongoose.isValidObjectId(ngoId)) {
      return res.status(400).json({ message: "Invalid requestId or ngoId" });
    }

    const ngo = await Ngo.findById(ngoId);
    if (!ngo) return res.status(404).json({ message: "NGO not found" });

    const ngoUser = await User.findOne({ _id: ngo.user, status: "approved" });
    if (!ngoUser) return res.status(400).json({ message: "NGO is not verified" });

    const request = await CrisisRequest.findById(requestId);
    if (!request) return res.status(404).json({ message: "Request not found" });
    if (!ngo.categories.includes(request.category)) {
      return res.status(400).json({ message: "NGO does not handle this category" });
    }

    // Atomic: only the volunteer who accepted it, only once
    const updated = await CrisisRequest.findOneAndUpdate(
      { _id: requestId, status: "accepted", acceptedBy: req.user.id },
      { status: "referred" },
      { new: true }
    );
    if (!updated) {
      return res
        .status(403)
        .json({ message: "Request is not accepted by you or already referred" });
    }

    try {
      const referral = await Referral.create({
        request: requestId,
        referredBy: req.user.id,
        ngo: ngoId,
        consentGiven: true,
        consentAt: new Date(),
      });
      res.status(201).json({ message: "Referral created", referral });
    } catch (err) {
      // roll back so the request isn't stuck as "referred"
      await CrisisRequest.updateOne({ _id: requestId }, { status: "accepted" });
      throw err;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// helper: find the Ngo profile of the logged-in NGO user
const getMyNgo = (req) => Ngo.findOne({ user: req.user.id });

// GET /api/referrals/mine  (NGO) — data-minimized: no seeker identity
exports.getNgoReferrals = async (req, res) => {
  try {
    if (!approvedOnly(req, res)) return;
    const ngo = await getMyNgo(req);
    if (!ngo) return res.status(404).json({ message: "NGO profile not found" });

    const referrals = await Referral.find({ ngo: ngo._id })
      .populate("request", "category description urgency")
      .select("request status createdAt")
      .sort({ createdAt: -1 });

    res.json({ referrals });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// PATCH /api/referrals/:id/status  (NGO) body: { status }
exports.updateReferralStatus = async (req, res) => {
  try {
    if (!approvedOnly(req, res)) return;
    const { status } = req.body;

    if (!REFERRAL_STATUSES.includes(status)) {
      return res
        .status(400)
        .json({ message: `status must be one of: ${REFERRAL_STATUSES.join(", ")}` });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid referral id" });
    }

    const ngo = await getMyNgo(req);
    if (!ngo) return res.status(404).json({ message: "NGO profile not found" });

    // scoped to this NGO's own referrals only
    const referral = await Referral.findOneAndUpdate(
      { _id: req.params.id, ngo: ngo._id },
      { status },
      { new: true }
    ).select("request status updatedAt");

    if (!referral) return res.status(404).json({ message: "Referral not found" });
    res.json({ message: "Status updated", referral });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};