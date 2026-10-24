const mongoose = require('mongoose');
const Notification = require('../models/Notification');

// T15.3 (BL-15) - a user's own notifications.
//
// Every query is filtered by req.user.id, so nobody can read or change another
// person's notifications. Asking for someone else's id answers 404, the same as
// an id that does not exist, so ids cannot be probed.

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

// ?limit=5 -> 5; missing, zero, negative or non-numeric -> the default; capped at MAX_LIMIT
const parseLimit = (value) => {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
};

// GET /api/notifications            newest first
// GET /api/notifications?unread=true&limit=10
exports.listMyNotifications = async (req, res) => {
  try {
    const filter = { user: req.user.id };
    if (req.query.unread === 'true') filter.read = false;

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseLimit(req.query.limit));

    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ message: 'Server error while fetching notifications.' });
  }
};

// GET /api/notifications/unread-count -> { count }
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({ user: req.user.id, read: false });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: 'Server error while counting notifications.' });
  }
};

// PATCH /api/notifications/:id/read -> { notification }
exports.markRead = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid notification id.' });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: id, user: req.user.id },
      { read: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found.' });
    }

    res.json({ notification });
  } catch (err) {
    res.status(500).json({ message: 'Server error while updating the notification.' });
  }
};

// PATCH /api/notifications/read-all -> { modified }
exports.markAllRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { user: req.user.id, read: false },
      { read: true }
    );
    res.json({ modified: result?.modifiedCount ?? 0 });
  } catch (err) {
    res.status(500).json({ message: 'Server error while updating the notifications.' });
  }
};
