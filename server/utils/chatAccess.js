const mongoose = require("mongoose");
const CrisisRequest = require("../models/CrisisRequest");

// Returns the request if this user may chat in it, otherwise null.
module.exports = async function chatAccess(user, requestId) {
  if (!mongoose.isValidObjectId(requestId)) return null;
  if (user.role === "volunteer" && user.status !== "approved") return null;

  const request = await CrisisRequest.findById(requestId).select("seeker acceptedBy status");
  if (!request || !request.acceptedBy) return null; // chat opens only after accept

  const uid = String(user.id);
  const isSeeker = String(request.seeker) === uid;
  const isVolunteer = String(request.acceptedBy) === uid;
  return isSeeker || isVolunteer ? request : null;
};