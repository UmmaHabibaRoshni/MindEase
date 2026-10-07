const express = require('express');
const router = express.Router();

// Middleware imports
const auth = require('../middleware/auth');
const allowRoles = require('../middleware/role');

// Controller imports
const { getMyAvailability, updateAvailability } = require('../controllers/availabilityController');

// Availability Routes
router.get("/availability", auth, allowRoles("volunteer"), getMyAvailability);
router.patch("/availability", auth, allowRoles("volunteer"), updateAvailability);

module.exports = router;