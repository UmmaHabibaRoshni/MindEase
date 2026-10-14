const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const allowRoles = require("../middleware/role");
const {
  createReferral,
  getNgoReferrals,
  getNgoReferral,
  updateReferralStatus,
} = require("../controllers/referralController");

router.post("/", auth, allowRoles("volunteer"), createReferral);
router.get("/mine", auth, allowRoles("ngo"), getNgoReferrals);
// Must stay below "/mine", otherwise "mine" would be read as an :id.
router.get("/:id", auth, allowRoles("ngo"), getNgoReferral);
router.patch("/:id/status", auth, allowRoles("ngo"), updateReferralStatus);

module.exports = router;