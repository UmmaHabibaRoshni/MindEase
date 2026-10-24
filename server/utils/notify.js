
const Notification = require("../models/Notification");

// Creates one notification. It never throws: a failed notification must not
// break the accept, refer or enroll that triggered it, so errors are logged only.
const notify = async (userId, type, message, link = "") => {
  try {
    if (!userId) return null;
    return await Notification.create({ user: userId, type, message, link });
  } catch (err) {
    console.error("notify failed:", err.message);
    return null;
  }
};

// The same notification for many users, e.g. everyone enrolled in a workshop.
const notifyMany = async (userIds, type, message, link = "") => {
  try {
    const ids = [...new Set((userIds || []).map(String))];
    if (ids.length === 0) return [];
    return await Notification.insertMany(
      ids.map((user) => ({ user, type, message, link }))
    );
  } catch (err) {
    console.error("notifyMany failed:", err.message);
    return [];
  }
};

module.exports = { notify, notifyMany };