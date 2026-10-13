const express = require('express');
const auth = require('../middleware/auth');
const allowRoles = require('../middleware/role');
const { getDashboardSummary } = require('../controllers/psychologistController');

const router = express.Router();

// Every route here is for an approved psychologist.
router.use(auth, allowRoles('psychologist'));

// T13.5
router.get('/summary', getDashboardSummary);

module.exports = router;
