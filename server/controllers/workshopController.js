
const mongoose = require("mongoose");
const Workshop = require("../models/Workshop");
const WorkshopEnrollment = require("../models/WorkshopEnrollment");
const { notify, notifyMany } = require("../utils/notify");

const approvedOnly = (req, res) => {
  if (req.user.status !== "approved") {
    res.status(403).json({ message: "Your account is not approved yet." });
    return false;
  }
  return true;
};

// the only fields a facilitator may set. status, enrolledCount and
// facilitator are never taken from the request body.
const EDITABLE = [
  "title",
  "description",
  "date",
  "time",
  "durationMinutes",
  "mode",
  "locationOrLink",
  "capacity",
  "tags",
];

const pickFields = (body) => {
  const data = {};
  EDITABLE.forEach((f) => {
    if (body[f] !== undefined) data[f] = body[f];
  });
  return data;
};

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// returns an error message, or null if the fields are fine
const checkFields = (data) => {
  if (data.tags !== undefined && !Array.isArray(data.tags)) {
    return "tags must be a list";
  }
  if (data.date !== undefined) {
    const d = new Date(data.date);
    if (isNaN(d.getTime())) return "Invalid date";
    if (d < startOfToday()) return "Workshop date cannot be in the past";
  }
  return null;
};

const handleError = (err, res) => {
  if (err.name === "ValidationError") {
    const message = Object.values(err.errors)
      .map((e) => e.message)
      .join(". ");
    return res.status(400).json({ message });
  }
  console.error(err);
  res.status(500).json({ message: "Server error" });
};

// POST /api/workshops  (facilitator)
exports.createWorkshop = async (req, res) => {
  try {
    if (!approvedOnly(req, res)) return;

    const data = pickFields(req.body);
    const problem = checkFields(data);
    if (problem) return res.status(400).json({ message: problem });

    const workshop = await Workshop.create({
      ...data,
      facilitator: req.user.id,
    });
    res.status(201).json({ message: "Workshop created", workshop });
  } catch (err) {
    handleError(err, res);
  }
};

// PATCH /api/workshops/:id  (facilitator, own workshops only)
exports.updateWorkshop = async (req, res) => {
  try {
    if (!approvedOnly(req, res)) return;
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid workshop id" });
    }

    // scoped to this facilitator's own workshops
    const workshop = await Workshop.findOne({
      _id: req.params.id,
      facilitator: req.user.id,
    });
    if (!workshop) return res.status(404).json({ message: "Workshop not found" });

    if (workshop.status === "Cancelled" || workshop.status === "Completed") {
      return res
        .status(400)
        .json({ message: `A ${workshop.status.toLowerCase()} workshop cannot be edited` });
    }

    const data = pickFields(req.body);
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }
    const problem = checkFields(data);
    if (problem) return res.status(400).json({ message: problem });

    if (data.capacity !== undefined && Number(data.capacity) < workshop.enrolledCount) {
      return res.status(400).json({
        message: `Capacity cannot be lower than the ${workshop.enrolledCount} seats already taken`,
      });
    }

    workshop.set(data);
    await workshop.save(); // runs the model's validation
    res.json({ message: "Workshop updated", workshop });
  } catch (err) {
    handleError(err, res);
  }
};

// PATCH /api/workshops/:id/cancel  (facilitator, own workshops only)
exports.cancelWorkshop = async (req, res) => {
  try {
    if (!approvedOnly(req, res)) return;
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid workshop id" });
    }

    const workshop = await Workshop.findOne({
      _id: req.params.id,
      facilitator: req.user.id,
    });
    if (!workshop) return res.status(404).json({ message: "Workshop not found" });

    if (workshop.status === "Cancelled") {
      return res.status(400).json({ message: "Workshop is already cancelled" });
    }
    if (workshop.status === "Completed") {
      return res.status(400).json({ message: "A completed workshop cannot be cancelled" });
    }

    await workshop.cancelWorkshop();

    // remember who was enrolled before their enrollments are cancelled
    const enrolled = await WorkshopEnrollment.find({
      workshop: workshop._id,
      status: "Enrolled",
    }).select("seeker");

    // the seekers who were enrolled are marked as cancelled too
    const result = await WorkshopEnrollment.updateMany(
      { workshop: workshop._id, status: "Enrolled" },
      {
        status: "Cancelled",
        cancellationReason: "Workshop cancelled by facilitator",
        cancelledAt: new Date(),
      }
    );

    // tell each of those seekers
    await notifyMany(
      enrolled.map((e) => e.seeker),
      "workshop_cancelled",
      `The workshop "${workshop.title}" was cancelled by the facilitator.`,
      "/dashboard/workshops"
    );

    res.json({
      message: "Workshop cancelled",
      enrollmentsCancelled: result.modifiedCount,
      workshop,
    });
  } catch (err) {
    handleError(err, res);
  }
};

// ---------- T12.5 seeker APIs ----------

// GET /api/workshops/available  (seeker)
exports.listAvailableWorkshops = async (req, res) => {
  try {
    const workshops = await Workshop.find({
      status: "Scheduled",
      date: { $gte: startOfToday() },
    })
      .populate("facilitator", "name")
      .sort({ date: 1 });
    res.json(workshops);
  } catch (err) {
    handleError(err, res);
  }
};

// POST /api/workshops/:id/enroll  (seeker)
exports.enroll = async (req, res) => {
  const { id } = req.params;
  try {
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid workshop id" });
    }

    // take one seat atomically: two seekers can't both get the last one
    const workshop = await Workshop.findOneAndUpdate(
      {
        _id: id,
        status: "Scheduled",
        date: { $gte: startOfToday() },
        $expr: { $lt: ["$enrolledCount", "$capacity"] },
      },
      { $inc: { enrolledCount: 1 } }
    );
    if (!workshop) {
      const w = await Workshop.findById(id);
      if (!w) return res.status(404).json({ message: "Workshop not found" });
      if (w.status !== "Scheduled" || w.date < startOfToday()) {
        return res.status(400).json({ message: "Workshop is not open for enrollment" });
      }
      return res.status(409).json({ message: "Workshop is full" });
    }

    // re-activate a cancelled enrollment, or create a new one
    let enrollment = await WorkshopEnrollment.findOneAndUpdate(
      { workshop: id, seeker: req.user.id, status: "Cancelled" },
      {
        $set: {
          status: "Enrolled",
          enrolledAt: new Date(),
          cancellationReason: null,
          cancelledAt: null,
        },
      },
      { new: true }
    );
    if (!enrollment) {
      try {
        enrollment = await WorkshopEnrollment.create({ workshop: id, seeker: req.user.id });
      } catch (err) {
        // couldn't enroll: give the seat back
        await Workshop.updateOne({ _id: id }, { $inc: { enrolledCount: -1 } });
        if (err.code === 11000) {
          return res.status(409).json({ message: "You are already enrolled" });
        }
        throw err;
      }
    }

    await notify(
      req.user.id,
      "workshop_enrolled",
      `You are enrolled in "${workshop.title}".`,
      "/dashboard/workshops"
    );

    res.status(201).json({ message: "Enrolled", enrollment });
  } catch (err) {
    handleError(err, res);
  }
};

// DELETE /api/workshops/:id/enroll  (seeker)
exports.cancelEnrollment = async (req, res) => {
  const { id } = req.params;
  try {
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid workshop id" });
    }
    const enrollment = await WorkshopEnrollment.findOneAndUpdate(
      { workshop: id, seeker: req.user.id, status: "Enrolled" },
      {
        $set: {
          status: "Cancelled",
          cancelledAt: new Date(),
          cancellationReason: req.body?.reason || "Cancelled by user",
        },
      },
      { new: true }
    );
    if (!enrollment) return res.status(404).json({ message: "You are not enrolled" });

    await Workshop.updateOne(
      { _id: id, enrolledCount: { $gt: 0 } },
      { $inc: { enrolledCount: -1 } }
    );
    res.json({ message: "Enrollment cancelled", enrollment });
  } catch (err) {
    handleError(err, res);
  }
};