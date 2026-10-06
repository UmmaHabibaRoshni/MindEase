
const express = require('express');
const auth = require('../middleware/auth');
const allowRoles = require('../middleware/role');
const { getPendingUsers, approveUser, rejectUser } = require('../controllers/adminController');

const router = express.Router();

// Every route here is admin only
router.use(auth, allowRoles('admin'));

router.get('/pending-users', getPendingUsers);
router.patch('/users/:id/approve', approveUser);
router.patch('/users/:id/reject', rejectUser);

module.exports = router;