
const express = require('express');
const auth = require('../middleware/auth');
const allowRoles = require('../middleware/role');
const {
  getPendingUsers,
  approveUser,
  rejectUser,
  listUsers,
  suspendUser,
  reactivateUser,
} = require('../controllers/adminController');
const { getAdminSummary } = require('../controllers/adminSummaryController');

const router = express.Router();

// Every route here is admin only
router.use(auth, allowRoles('admin'));

// T16.3 - dashboard numbers
router.get('/summary', getAdminSummary);

router.get('/pending-users', getPendingUsers);
router.patch('/users/:id/approve', approveUser);
router.patch('/users/:id/reject', rejectUser);

// T16.5 - user management: list with filters, suspend, reactivate
router.get('/users', listUsers);
router.patch('/users/:id/suspend', suspendUser);
router.patch('/users/:id/reactivate', reactivateUser);

module.exports = router;