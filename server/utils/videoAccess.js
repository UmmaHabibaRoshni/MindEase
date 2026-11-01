const mongoose = require("mongoose");
const Workshop = require("../models/Workshop");
const WorkshopEnrollment = require("../models/WorkshopEnrollment");
const CaseAssignment = require("../models/CaseAssignment");

// Who may open a video room (T18.2, T18.3).
//
// Same idea as chatAccess.js, but these return a reason instead of null, so
// the controller can answer 400 / 403 / 404 properly and the rules stay
// testable on their own (T18.4).
//
//   { ok: true,  ...context }
//   { ok: false, status, message }

const deny = (status, message) => ({ ok: false, status, message });
const same = (a, b) => String(a) === String(b);

/**
 * An online workshop's room: the facilitator who owns it, or a seeker whose
 * enrollment is still active. Cancelled workshops have no room.
 */
async function workshopVideoAccess(user, workshopId) {
  if (!mongoose.isValidObjectId(workshopId)) {
    return deny(400, "Invalid workshop id");
  }

  const workshop = await Workshop.findById(workshopId).select(
    "title facilitator mode status"
  );
  if (!workshop) return deny(404, "Workshop not found");

  if (workshop.mode !== "Online") {
    return deny(400, "This workshop is not held online, so it has no video room.");
  }
  if (workshop.status === "Cancelled") {
    return deny(400, "This workshop has been cancelled.");
  }

  if (user.role === "facilitator" && same(workshop.facilitator, user.id)) {
    return { ok: true, workshop, isModerator: true };
  }

  if (user.role === "seeker") {
    const enrollment = await WorkshopEnrollment.findOne({
      workshop: workshop._id,
      seeker: user.id,
      status: { $in: ["Enrolled", "Attended"] },
    }).select("_id");
    if (enrollment) return { ok: true, workshop, isModerator: false };
  }

  return deny(403, "You are not part of this workshop.");
}

/**
 * A case consultation room: the psychologist the case is assigned to, or the
 * seeker who raised the underlying request. Only once the case is accepted.
 */
async function caseVideoAccess(user, caseId) {
  if (!mongoose.isValidObjectId(caseId)) {
    return deny(400, "Invalid case id");
  }

  const assignment = await CaseAssignment.findById(caseId)
    .select("psychologist request status")
    .populate("request", "seeker");
  if (!assignment) return deny(404, "Case not found");

  if (assignment.status !== "accepted") {
    return deny(
      400,
      "This case is not accepted, so there is no consultation room yet."
    );
  }

  if (user.role === "psychologist" && same(assignment.psychologist, user.id)) {
    return { ok: true, assignment, isModerator: true };
  }

  if (user.role === "seeker" && same(assignment.request?.seeker, user.id)) {
    return { ok: true, assignment, isModerator: false };
  }

  return deny(403, "You are not part of this case.");
}

/**
 * The same consultation room, found from the crisis request instead of the
 * case id. The seeker never sees a CaseAssignment id - their dashboard lists
 * requests - so without this they could not reach the room at all (T18.9).
 *
 * The room is still derived from the ASSIGNMENT id, so this returns exactly
 * the room caseVideoAccess returns. Both sides must land in the same place.
 */
async function requestVideoAccess(user, requestId) {
  if (!mongoose.isValidObjectId(requestId)) {
    return deny(400, "Invalid request id");
  }

  const assignment = await CaseAssignment.findOne({
    request: requestId,
    status: "accepted",
  })
    .select("psychologist request status")
    .populate("request", "seeker");

  if (!assignment) {
    return deny(404, "There is no accepted consultation for this request yet.");
  }

  if (user.role === "psychologist" && same(assignment.psychologist, user.id)) {
    return { ok: true, assignment, isModerator: true };
  }

  if (user.role === "seeker" && same(assignment.request?.seeker, user.id)) {
    return { ok: true, assignment, isModerator: false };
  }

  return deny(403, "You are not part of this case.");
}

module.exports = { workshopVideoAccess, caseVideoAccess, requestVideoAccess };
