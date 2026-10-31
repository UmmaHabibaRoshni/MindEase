const User = require("../models/User");
const { roomFor } = require("../utils/videoRoom");
const { workshopVideoAccess, caseVideoAccess } = require("../utils/videoAccess");

// T18.2 / T18.3 - video room details for an online workshop and for a case.
//
// Nothing is stored: the room name is derived from the id (see utils/videoRoom.js),
// so these are read-only lookups that answer "may I join, and where?".
// T18.1 settled on opening the URL in a new tab, so the response carries a
// ready-made `url` as well as the parts an embedded player would need.

// Jitsi prefills the name box from displayName, so the other side sees a real
// name instead of "Fellow Jitster".
const displayNameOf = async (userId) => {
  const account = await User.findById(userId).select("name");
  return account?.name || "";
};

const handleError = (err, res) => {
  console.error(err);
  res.status(500).json({ message: "Server error" });
};

// GET /api/video/workshop/:id   (facilitator who owns it, or an enrolled seeker)
exports.getWorkshopRoom = async (req, res) => {
  try {
    const access = await workshopVideoAccess(req.user, req.params.id);
    if (!access.ok) return res.status(access.status).json({ message: access.message });

    const room = roomFor("workshop", access.workshop._id, {
      displayName: await displayNameOf(req.user.id),
      subject: access.workshop.title,
      isModerator: access.isModerator,
    });

    res.json({
      ...room,
      workshop: { id: access.workshop._id, title: access.workshop.title },
    });
  } catch (err) {
    handleError(err, res);
  }
};

// GET /api/video/case/:id   (the assigned psychologist, or the seeker on the case)
exports.getCaseRoom = async (req, res) => {
  try {
    const access = await caseVideoAccess(req.user, req.params.id);
    if (!access.ok) return res.status(access.status).json({ message: access.message });

    const room = roomFor("case", access.assignment._id, {
      displayName: await displayNameOf(req.user.id),
      subject: "MindEase consultation",
      isModerator: access.isModerator,
    });

    res.json({ ...room, case: { id: access.assignment._id } });
  } catch (err) {
    handleError(err, res);
  }
};
