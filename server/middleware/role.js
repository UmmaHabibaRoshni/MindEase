
// Usage: allowRoles('admin', 'volunteer')
module.exports = function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You are not allowed to access this resource.' });
    }
    next();
  };
};