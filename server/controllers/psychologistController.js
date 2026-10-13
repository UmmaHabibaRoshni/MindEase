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

// ---------------------------------------------------------------------------
// Added for the dashboard frontend, which calls these two paths.
// ---------------------------------------------------------------------------

const CrisisRequest = require('../models/CrisisRequest');
const { REQUEST_STATUSES } = require('../config/requestOptions');

const CASE_STATUSES = CaseAssignment.schema.path('status').enumValues;
const SORTABLE = ['createdAt', 'updatedAt', 'status'];
const MAX_LIMIT = 100;

// The frontend sends capitalised statuses ("Accepted"); the model stores them
// lowercase. Normalise rather than make the client change.
const normaliseStatus = (value) => String(value || '').trim().toLowerCase();

// Which status a case may move to, and what that does to the crisis request.
const TRANSITIONS = {
  accepted: { from: ['pending'], request: null },
  // A rejected case goes back to the volunteer so it is not left stranded.
  rejected: { from: ['pending'], request: REQUEST_STATUSES.ACCEPTED },
  completed: { from: ['accepted'], request: 'closed' },
};

/**
 * GET /api/psychologist/cases
 * Psychologist only.
 * Query: status, page, limit, sortBy, sortOrder.
 *
 * Paginated because the dashboard asks for a page at a time.
 */
exports.listCases = async (req, res) => {
  try {
    const filter = { psychologist: req.user.id };

    const status = normaliseStatus(req.query.status);
    if (status && status !== 'all') {
      if (!CASE_STATUSES.includes(status)) {
        return res.status(400).json({ message: 'Unknown status filter.' });
      }
      filter.status = status;
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const sortBy = SORTABLE.includes(req.query.sortBy) ? req.query.sortBy : 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    const [total, cases] = await Promise.all([
      CaseAssignment.countDocuments(filter),
      CaseAssignment.find(filter)
        .populate('request', 'category urgency description status createdAt')
        .populate('volunteer', 'name email')
        .sort({ [sortBy]: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    return res.json({
      data: cases,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error while loading your cases.' });
  }
};

/**
 * PATCH /api/psychologist/cases/:id/status   body: { status, decisionReason }
 * Psychologist only. Accept, reject or complete one of their own cases.
 */
exports.updateCaseStatus = async (req, res) => {
  try {
    const status = normaliseStatus(req.body.status);
    const transition = TRANSITIONS[status];

    if (!transition) {
      return res.status(400).json({
        message: `Status must be one of: ${Object.keys(TRANSITIONS).join(', ')}.`,
      });
    }

    const assignment = await loadOwnCase(req, res);
    if (!assignment) return undefined;

    if (!transition.from.includes(assignment.status)) {
      return res.status(409).json({
        message: `Cannot change a case from ${assignment.status} to ${status}.`,
      });
    }

    assignment.status = status;
    const reason = (req.body.decisionReason || '').trim();
    if (reason) assignment.decisionReason = reason;
    await assignment.save();

    if (transition.request) {
      await CrisisRequest.findByIdAndUpdate(assignment.request, { status: transition.request });
    }

    return res.json({ message: `Case ${status}.`, data: assignment });
  } catch (err) {
    return res.status(500).json({ message: 'Server error while updating the case.' });
  }
};
