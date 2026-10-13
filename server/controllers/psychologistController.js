const CaseAssignment = require('../models/CaseAssignment');

// BL-13 psychologist dashboard.
// T13.5 - counts for the logged-in psychologist's own cases.

/**
 * GET /api/psychologist/summary
 * Psychologist only.
 *
 * Returns one count per case status plus a total, so the dashboard can render
 * its tiles from a single request instead of fetching every case and counting
 * them in the browser.
 */
exports.getDashboardSummary = async (req, res) => {
  try {
    const statuses = CaseAssignment.schema.path('status').enumValues;
    const mine = { psychologist: req.user.id };

    const counts = await Promise.all(
      statuses.map((status) => CaseAssignment.countDocuments({ ...mine, status }))
    );

    const summary = statuses.reduce(
      (acc, status, i) => ({ ...acc, [status]: counts[i] }),
      {}
    );
    summary.total = counts.reduce((sum, n) => sum + n, 0);

    return res.json({ summary });
  } catch (err) {
    return res.status(500).json({ message: 'Server error while loading the dashboard summary.' });
  }
};
