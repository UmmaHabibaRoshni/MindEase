
const mongoose = require('mongoose');
const User = require('../models/User');
const { notify } = require('../utils/notify');

// GET /api/admin/pending-users
exports.getPendingUsers = async (req, res) => {
  try {
    const users = await User.find({ status: 'pending' })
      .select('-password')
      .sort({ createdAt: -1 });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: 'Server error while fetching pending accounts.' });
  }
};

// Shared logic for approve and reject
async function reviewUser(req, res, newStatus, reason) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'Invalid user id.' });
  }

  const user = await User.findById(id);
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }
  if (user.status !== 'pending') {
    return res.status(400).json({ message: `This account is already ${user.status}.` });
  }

  user.status = newStatus;
  user.verifiedBy = req.user.id;
  user.verifiedAt = new Date();
  if (newStatus === 'rejected') user.rejectionReason = reason;

  await user.save();

  // tell the user what happened to their account (notify never throws)
  if (newStatus === 'approved') {
    await notify(
      user._id,
      'account_approved',
      'Your account was approved. You can log in now.',
      '/dashboard'
    );
  } else {
    await notify(
      user._id,
      'account_rejected',
      `Your account was not approved. Reason: ${reason}`,
      '/login'
    );
  }

  const safeUser = user.toObject();
  delete safeUser.password;
  return res.json({ message: `Account ${newStatus}.`, user: safeUser });
}

// PATCH /api/admin/users/:id/approve
exports.approveUser = async (req, res) => {
  try {
    await reviewUser(req, res, 'approved');
  } catch (err) {
    res.status(500).json({ message: 'Server error while approving the account.' });
  }
};

// PATCH /api/admin/users/:id/reject   body: { reason }
exports.rejectUser = async (req, res) => {
  try {
    const reason = (req.body.reason || '').trim();
    if (!reason) {
      return res.status(400).json({ message: 'A rejection reason is required.' });
    }
    await reviewUser(req, res, 'rejected', reason);
  } catch (err) {
    res.status(500).json({ message: 'Server error while rejecting the account.' });
  }
};

// ---------------------------------------------------------------- T16.5 (BL-16)

const ROLES = ['seeker', 'volunteer', 'psychologist', 'ngo', 'facilitator', 'admin'];
const STATUSES = ['pending', 'approved', 'rejected', 'suspended'];
const REASON_MAX = 500;
const LIST_LIMIT = 500;

// "a.b" typed in the search box must match the text "a.b", not "a" + anything + "b"
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/admin/users?role=&status=&q=
exports.listUsers = async (req, res) => {
  try {
    const { role, status, q } = req.query;

    for (const [name, value] of [['role', role], ['status', status], ['q', q]]) {
      if (value !== undefined && typeof value !== 'string') {
        return res.status(400).json({ message: `Invalid ${name} filter.` });
      }
    }
    if (role && !ROLES.includes(role)) {
      return res.status(400).json({ message: 'Invalid role filter.' });
    }
    if (status && !STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status filter.' });
    }

    const filter = {};
    if (role) filter.role = role;
    if (status) filter.status = status;

    const search = (q || '').trim();
    if (search) {
      const pattern = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ name: pattern }, { email: pattern }];
    }

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(LIST_LIMIT);

    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: 'Server error while fetching users.' });
  }
};

// PATCH /api/admin/users/:id/suspend   body: { reason }
exports.suspendUser = async (req, res) => {
  try {
    const { id } = req.params;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';

    if (!reason) {
      return res.status(400).json({ message: 'A suspension reason is required.' });
    }
    if (reason.length > REASON_MAX) {
      return res
        .status(400)
        .json({ message: `The reason must be ${REASON_MAX} characters or fewer.` });
    }
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid user id.' });
    }
    // an admin suspending themselves could lock the last admin out
    if (String(id) === String(req.user.id)) {
      return res.status(400).json({ message: 'You cannot suspend your own account.' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    if (user.status === 'suspended') {
      return res.status(400).json({ message: 'This account is already suspended.' });
    }
    if (user.status !== 'approved') {
      return res.status(400).json({
        message: `Only approved accounts can be suspended. This account is ${user.status}.`,
      });
    }

    user.status = 'suspended';
    user.suspendedBy = req.user.id;
    user.suspendedAt = new Date();
    user.suspensionReason = reason;
    await user.save();

    const safeUser = user.toObject();
    delete safeUser.password;
    res.json({ message: 'Account suspended.', user: safeUser });
  } catch (err) {
    res.status(500).json({ message: 'Server error while suspending the account.' });
  }
};

// PATCH /api/admin/users/:id/reactivate
exports.reactivateUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid user id.' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    if (user.status !== 'suspended') {
      return res.status(400).json({ message: 'This account is not suspended.' });
    }

    user.status = 'approved';
    user.suspendedBy = null;
    user.suspendedAt = null;
    user.suspensionReason = '';
    await user.save();

    // tell the user they can come back (notify never throws)
    await notify(
      user._id,
      'account_approved',
      'Your account has been reactivated. Welcome back.',
      '/dashboard'
    );

    const safeUser = user.toObject();
    delete safeUser.password;
    res.json({ message: 'Account reactivated.', user: safeUser });
  } catch (err) {
    res.status(500).json({ message: 'Server error while reactivating the account.' });
  }
};
