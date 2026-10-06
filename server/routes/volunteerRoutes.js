const express = require("express");
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const {
  getMyAvailability,
  updateAvailability,
} = require("../controllers/availabilityController");

router.get("/availability", protect, authorize("volunteer"), getMyAvailability);
router.patch("/availability", protect, authorize("volunteer"), updateAvailability);

module.exports = router;