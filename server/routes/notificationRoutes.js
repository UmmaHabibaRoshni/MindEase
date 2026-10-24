const express = require('express');
const auth = require('../middleware/auth');
const allowRoles = require('../middleware/role');
const {
  listMyNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
} = require('../controllers/notificationController');

const router = express.Router();

// Every signed-in role has a bell, so every role is allowed; the controller
// then only ever touches the caller's own notifications.
const ALL_ROLES = ['seeker', 'volunteer', 'psychologist', 'ngo', 'facilitator', 'admin'];

router.use(auth, allowRoles(...ALL_ROLES));

router.get('/', listMyNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markRead);

module.exports = router;
