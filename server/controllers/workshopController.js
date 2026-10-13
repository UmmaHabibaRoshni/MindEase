
const mongoose = require("mongoose");
const Workshop = require("../models/Workshop");
const WorkshopEnrollment = require("../models/WorkshopEnrollment");

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

    // the seekers who were enrolled are marked as cancelled too
    const result = await WorkshopEnrollment.updateMany(
      { workshop: workshop._id, status: "Enrolled" },
      {
        status: "Cancelled",
        cancellationReason: "Workshop cancelled by facilitator",
        cancelledAt: new Date(),
      }
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