const express = require('express');
const router = express.Router();

// Import default auth function
const auth = require('../middleware/auth'); 

// Import authorize/role middleware (check if exported as { authorize } or default)
const { authorize } = require('../middleware/role'); 

// Import controller functions
const { getMyAvailability, updateAvailability } = require('../controllers/availabilityController');

// Routes using 'auth' instead of 'protect'
router.get("/availability", auth, authorize("volunteer"), getMyAvailability);
router.patch("/availability", auth, authorize("volunteer"), updateAvailability);

module.exports = router;