const User = require('../models/User');
const CrisisRequest = require('../models/CrisisRequest');
const Workshop = require('../models/Workshop');
const Referral = require('../models/Referral');
const WorkshopEnrollment = require('../models/WorkshopEnrollment');

// T16.3 (BL-16) - the numbers behind the admin dashboard.
//
// Everything is counted in the database with $group rather than pulled into
// Node and counted here, so the work does not grow with the size of the
// collection.
//
// The buckets come from the schema enums, not from a list typed out here. That
// matters: T16.1 adds a 'suspended' status to User, and when it lands this API
// starts reporting it on its own, with no edit. The same holds for a new
// request category or workshop status.

// Reads the allowed values straight off the model.
const valuesOf = (Model, path) => {
  const field = Model.schema.path(path);
  return field && Array.isArray(field.enumValues) ? field.enumValues : [];
};

// Turns [{ _id: 'pending', count: 3 }] into { pending: 3, approved: 0, ... }.
// Every known bucket is present even when it is empty, so the dashboard can
// render a fixed set of cards without checking for undefined.
function tally(rows, known) {
  const out = {};
  known.forEach((key) => {
    out[key] = 0;
  });

  rows.forEach(({ _id, count }) => {
    if (_id === null || _id === undefined) return;
    const key = String(_id);
    // A value that is in the data but not in the enum still gets reported
    // rather than silently dropped - that would hide a real data problem.
    out[key] = (out[key] || 0) + count;
  });

  return out;
}

const countBy = (Model, field) =>
  Model.aggregate([{ $group: { _id: `$${field}`, count: { $sum: 1 } } }]);

const sumOf = (obj) => Object.values(obj).reduce((total, n) => total + n, 0);

// GET /api/admin/summary
exports.getAdminSummary = async (req, res) => {
  try {
    const [
      usersByRole,
      usersByStatus,
      requestsByStatus,
      requestsByCategory,
      workshopsByStatus,
      referralsByStatus,
      enrollments,
    ] = await Promise.all([
      countBy(User, 'role'),
      countBy(User, 'status'),
      countBy(CrisisRequest, 'status'),
      countBy(CrisisRequest, 'category'),
      countBy(Workshop, 'status'),
      countBy(Referral, 'status'),
      WorkshopEnrollment.countDocuments({ status: 'Enrolled' }),
    ]);

    const users = {
      byRole: tally(usersByRole, valuesOf(User, 'role')),
      byStatus: tally(usersByStatus, valuesOf(User, 'status')),
    };
    const requests = {
      byStatus: tally(requestsByStatus, valuesOf(CrisisRequest, 'status')),
      byCategory: tally(requestsByCategory, valuesOf(CrisisRequest, 'category')),
    };
    const workshops = { byStatus: tally(workshopsByStatus, valuesOf(Workshop, 'status')) };
    const referrals = { byStatus: tally(referralsByStatus, valuesOf(Referral, 'status')) };

    // Totals are added up from the buckets rather than counted again, so a
    // total can never disagree with the numbers printed beside it.
    users.total = sumOf(users.byRole);
    requests.total = sumOf(requests.byStatus);
    workshops.total = sumOf(workshops.byStatus);
    workshops.activeEnrollments = enrollments;
    referrals.total = sumOf(referrals.byStatus);

    res.json({ users, requests, workshops, referrals, generatedAt: new Date() });
  } catch (err) {
    res.status(500).json({ message: 'Server error while building the admin summary.' });
  }
};
