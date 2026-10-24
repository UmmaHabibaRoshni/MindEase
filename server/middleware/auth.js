
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');

// Verifies the JWT token, then checks the account in the database (T16.1).
//
// The token alone is not enough: it stays valid until it expires, so a user an
// admin has suspended would otherwise keep working until then. Reading the
// account on every request also means req.user carries the CURRENT role and
// status, not the ones the token was signed with.
//
// req.user = { id, role, status }
module.exports = async function auth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided. Access denied.' });
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }

  if (!decoded || !mongoose.isValidObjectId(decoded.id)) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }

  let account;
  try {
    account = await User.findById(decoded.id).select('role status');
  } catch (err) {
    return res.status(500).json({ message: 'Could not verify your account.' });
  }

  if (!account) {
    return res.status(401).json({ message: 'This account no longer exists.' });
  }

  if (account.status === 'suspended') {
    return res.status(403).json({
      message: 'Your account has been suspended. Please contact support.',
      code: 'ACCOUNT_SUSPENDED',
    });
  }

  req.user = { id: decoded.id, role: account.role, status: account.status };
  next();
};
