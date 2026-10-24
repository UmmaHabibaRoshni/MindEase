const mongoose = require("mongoose");
const CrisisRequest = require("../models/CrisisRequest");
const Ngo = require("../models/Ngo");
const User = require("../models/User");
const Referral = require("../models/Referral");
const { notify } = require("../utils/notify");
const { REFERRAL_STATUSES, NOTE_MAX } = Referral;

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

      // tell the seeker and the NGO (notify never throws)
      await notify(
        request.seeker,
        "referral_created",
        "Your request was referred to an NGO that can help.",
        "/dashboard/seeker"
      );
      await notify(
        ngoUser._id,
        "referral_created",
        "You have a new referral from a volunteer.",
        "/dashboard/ngo"
      );

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

const statusMessage = `status must be one of: ${REFERRAL_STATUSES.join(", ")}`;

// ---------------------------------------------------------------------------
// T14.4  GET /api/referrals/mine?status=pending   (NGO)
//
// Lists the referrals sent to the logged-in NGO, newest first.
//   - ?status=<one of REFERRAL_STATUSES> is optional; leave it out for all.
//   - Data-minimised: the seeker's identity is never selected or populated.
//   - The NGO is taken from the login token, never from the request, so one
//     NGO can never list another NGO's referrals.
// ---------------------------------------------------------------------------
exports.getNgoReferrals = async (req, res) => {
  try {
    if (!approvedOnly(req, res)) return;

    // Validate the filter before touching the database. typeof guards against
    // ?status=a&status=b, which arrives as an array.
    const { status } = req.query;
    const filterByStatus = status !== undefined && status !== "";
    if (filterByStatus && (typeof status !== "string" || !REFERRAL_STATUSES.includes(status))) {
      return res.status(400).json({ message: statusMessage });
    }

    const ngo = await getMyNgo(req);
    if (!ngo) return res.status(404).json({ message: "NGO profile not found" });

    const filter = { ngo: ngo._id };
    if (filterByStatus) filter.status = status;

    const referrals = await Referral.find(filter)
      .populate("request", "category description urgency")
      .select("request status note respondedAt createdAt updatedAt")
      .sort({ createdAt: -1 });

    res.json({ count: referrals.length, referrals });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ---------------------------------------------------------------------------
// GET /api/referrals/:id   (NGO)   -> { referral }
//
// One referral, for the referral page (T14.8). Same rules as the list:
//   - scoped to the logged-in NGO, so another NGO's referral is a 404;
//   - data-minimised: no seeker identity.
// ---------------------------------------------------------------------------
exports.getNgoReferral = async (req, res) => {
  try {
    if (!approvedOnly(req, res)) return;

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid referral id" });
    }

    const ngo = await getMyNgo(req);
    if (!ngo) return res.status(404).json({ message: "NGO profile not found" });

    const referral = await Referral.findOne({ _id: req.params.id, ngo: ngo._id })
      .populate("request", "category description urgency")
      .select("request status note respondedAt createdAt updatedAt");

    if (!referral) return res.status(404).json({ message: "Referral not found" });

    res.json({ referral });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ---------------------------------------------------------------------------
// T14.5  PATCH /api/referrals/:id/status   (NGO)
//        body: { status, note? }
//
// Updates a referral's status and, optionally, the NGO's note.
//   - Only the NGO that owns the referral can update it (404 otherwise, so the
//     existence of other NGOs' referrals is not revealed).
//   - The referral is loaded and saved as a document, not updated with
//     findOneAndUpdate, so the model's pre-validate hook runs and stamps
//     respondedAt (T14.1). findOneAndUpdate would skip that hook.
//   - respondedBy records the first NGO user who moved it off "pending".
//   - Leaving "note" out keeps the existing note; sending "" clears it.
// ---------------------------------------------------------------------------
exports.updateReferralStatus = async (req, res) => {
  try {
    if (!approvedOnly(req, res)) return;
    const { status, note } = req.body || {};

    if (!REFERRAL_STATUSES.includes(status)) {
      return res.status(400).json({ message: statusMessage });
    }

    let cleanNote;
    if (note !== undefined && note !== null) {
      if (typeof note !== "string") {
        return res.status(400).json({ message: "note must be text" });
      }
      cleanNote = note.trim();
      if (cleanNote.length > NOTE_MAX) {
        return res
          .status(400)
          .json({ message: `note cannot be longer than ${NOTE_MAX} characters` });
      }
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid referral id" });
    }

    const ngo = await getMyNgo(req);
    if (!ngo) return res.status(404).json({ message: "NGO profile not found" });

    // scoped to this NGO's own referrals only
    const referral = await Referral.findOne({ _id: req.params.id, ngo: ngo._id });
    if (!referral) return res.status(404).json({ message: "Referral not found" });

    referral.status = status;
    if (cleanNote !== undefined) referral.note = cleanNote;
    if (status !== "pending" && !referral.respondedBy) {
      referral.respondedBy = req.user.id;
    }

    // pre("validate") sets respondedAt, or clears the response when the
    // status goes back to pending.
    await referral.save();

    // Send the request back expanded (category, description, urgency), the
    // same shape the list and GET /:id use, so the frontend can drop the
    // response straight into its state.
    await referral.populate("request", "category description urgency");

    res.json({
      message: "Status updated",
      referral: {
        _id: referral._id,
        request: referral.request,
        status: referral.status,
        note: referral.note,
        respondedAt: referral.respondedAt,
        respondedBy: referral.respondedBy,
        createdAt: referral.createdAt,
        updatedAt: referral.updatedAt,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};