const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  getMyAvailability,
  updateAvailability,
} = require("../controllers/availabilityController");

router.get("/availability", protect, authorize("volunteer"), getMyAvailability);
router.patch("/availability", protect, authorize("volunteer"), updateAvailability);

module.exports = router;