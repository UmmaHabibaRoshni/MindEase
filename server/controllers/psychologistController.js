const mongoose = require('mongoose');
const CaseAssignment = require('../models/CaseAssignment');
const CaseNote = require('../models/CaseNote');

// BL-13 psychologist dashboard.
// T13.5 - summary counts.
// T13.4 - case detail, plus adding and listing the psychologist's private notes.

const NOTE_MAX = CaseNote.schema.path('text').options.maxlength;

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

/**
 * Loads a case and checks it belongs to the caller.
 * Writes the error response itself and returns null when it does not.
 */
async function loadOwnCase(req, res, { populate = false } = {}) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ message: 'Invalid case id.' });
    return null;
  }

  const query = CaseAssignment.findById(id);
  if (populate) {
    query
      .populate('request', 'category urgency description status createdAt')
      .populate('volunteer', 'name email');
  }

  const assignment = await query;
  if (!assignment) {
    res.status(404).json({ message: 'Case not found.' });
    return null;
  }

  // A psychologist may only ever see their own cases.
  if (String(assignment.psychologist) !== String(req.user.id)) {
    res.status(403).json({ message: 'This case is not assigned to you.' });
    return null;
  }

  return assignment;
}

/**
 * GET /api/psychologist/cases/:id
 * Psychologist only. The crisis request, the volunteer's handover summary and
 * who handed it over, in one response.
 */
exports.getCaseDetail = async (req, res) => {
  try {
    const assignment = await loadOwnCase(req, res, { populate: true });
    if (!assignment) return undefined;

    return res.json({ case: assignment });
  } catch (err) {
    return res.status(500).json({ message: 'Server error while loading the case.' });
  }
};

/**
 * POST /api/psychologist/cases/:id/notes   body: { text }
 * Psychologist only. Notes are private to the psychologist who wrote them.
 */
exports.addCaseNote = async (req, res) => {
  try {
    const text = (req.body.text || '').trim();
    if (!text) {
      return res.status(400).json({ message: 'A note cannot be empty.' });
    }
    if (text.length > NOTE_MAX) {
      return res.status(400).json({ message: `A note cannot be longer than ${NOTE_MAX} characters.` });
    }

    const assignment = await loadOwnCase(req, res);
    if (!assignment) return undefined;

    const note = await CaseNote.create({
      assignment: assignment._id,
      psychologist: req.user.id,
      text,
    });

    return res.status(201).json({ message: 'Note added.', note });
  } catch (err) {
    return res.status(500).json({ message: 'Server error while adding the note.' });
  }
};

/**
 * GET /api/psychologist/cases/:id/notes
 * Psychologist only. Newest first, and only the caller's own notes.
 */
exports.listCaseNotes = async (req, res) => {
  try {
    const assignment = await loadOwnCase(req, res);
    if (!assignment) return undefined;

    const notes = await CaseNote.find({
      assignment: assignment._id,
      psychologist: req.user.id,
    }).sort({ createdAt: -1 });

    return res.json({ count: notes.length, notes });
  } catch (err) {
    return res.status(500).json({ message: 'Server error while loading the notes.' });
  }
};
