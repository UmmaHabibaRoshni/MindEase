
const express = require('express');
const auth = require('../middleware/auth');
const allowRoles = require('../middleware/role');
const { getPendingUsers, approveUser, rejectUser } = require('../controllers/adminController');
const { getAdminSummary } = require('../controllers/adminSummaryController');

const router = express.Router();

// Every route here is admin only
router.use(auth, allowRoles('admin'));

// T16.3 - dashboard numbers
router.get('/summary', getAdminSummary);

router.get('/pending-users', getPendingUsers);
router.patch('/users/:id/approve', approveUser);
router.patch('/users/:id/reject', rejectUser);

module.exports = router;