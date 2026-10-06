
const auth = require('./auth');

module.exports = function optionalAuth(req, res, next) {
  if (!req.headers.authorization) return next();
  return auth(req, res, next);
};