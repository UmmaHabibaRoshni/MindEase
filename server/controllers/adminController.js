
const mongoose = require('mongoose');
const User = require('../models/User');

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