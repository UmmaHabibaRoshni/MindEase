const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const allowRoles = require("../middleware/role");
const { getWorkshopRoom, getCaseRoom } = require("../controllers/videoController");

// BL-18 video rooms (T18.2, T18.3).
//
// Each route is open to the two roles that can appear on either side of the
// call; which *particular* facilitator, seeker or psychologist is allowed is
// decided per record in utils/videoAccess.js, not here.
router.get("/workshop/:id", auth, allowRoles("facilitator", "seeker"), getWorkshopRoom);
router.get("/case/:id", auth, allowRoles("psychologist", "seeker"), getCaseRoom);

module.exports = router;
