const mongoose = require('mongoose');
const CaseAssignment = require('../models/CaseAssignment');
const CrisisRequest = require('../models/CrisisRequest');
const User = require('../models/User');
const { REQUEST_STATUSES } = require('../config/requestOptions');

// BL-9 escalation APIs.
// T9.4 - a volunteer escalates a request they are handling to a psychologist.
// T9.5 - the psychologist sees their queue and accepts / rejects / completes.

const SUMMARY_MIN = 20;

// A case is still "live" while the psychologist has not rejected it, so a
// request cannot be escalated twice at the same time.
const OPEN_STATUSES = ['pending', 'accepted'];

/**
 * POST /api/escalations
 * Volunteer only. body: { requestId, psychologistId, summary }
 */
exports.createEscalation = async (req, res) => {
  try {
    const { requestId, psychologistId, summary } = req.body;

    if (!mongoose.isValidObjectId(requestId) || !mongoose.isValidObjectId(psychologistId)) {
      return res.status(400).json({ message: 'A valid requestId and psychologistId are required.' });
    }

    const trimmedSummary = (summary || '').trim();
    if (trimmedSummary.length < SUMMARY_MIN) {
      return res.status(400).json({
        message: `A handover summary of at least ${SUMMARY_MIN} characters is required.`,
      });
    }

    const request = await CrisisRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: 'Crisis request not found.' });
    }

    // Only the volunteer who accepted the case may hand it over.
    if (String(request.acceptedBy) !== String(req.user.id)) {
      return res.status(403).json({ message: 'You can only escalate a request you accepted.' });
    }

    if (request.status !== REQUEST_STATUSES.ACCEPTED) {
      return res.status(409).json({ message: `This request is ${request.status} and cannot be escalated.` });
    }

    const psychologist = await User.findById(psychologistId);
    if (!psychologist || psychologist.role !== 'psychologist') {
      return res.status(404).json({ message: 'Psychologist not found.' });
    }
    if (psychologist.status !== 'approved') {
      return res.status(400).json({ message: 'That psychologist is not approved yet.' });
    }

    const existing = await CaseAssignment.findOne({
      request: requestId,
      status: { $in: OPEN_STATUSES },
    });
    if (existing) {
      return res.status(409).json({ message: 'This request has already been escalated.' });
    }

    const assignment = await CaseAssignment.create({
      request: requestId,
      volunteer: req.user.id,
      psychologist: psychologistId,
      summary: trimmedSummary,
    });

    request.status = REQUEST_STATUSES.ESCALATED;
    await request.save();

    return res.status(201).json({ message: 'Request escalated to the psychologist.', assignment });
  } catch (err) {
    return res.status(500).json({ message: 'Server error while escalating the request.' });
  }
};

/**
 * GET /api/escalations/psychologists
 * Volunteer only - the approved psychologists available to escalate to.
 */
exports.getPsychologists = async (req, res) => {
  try {
    const psychologists = await User.find({ role: 'psychologist', status: 'approved' })
      .select('name email')
      .sort({ name: 1 });

    return res.json({ psychologists });
  } catch (err) {
    return res.status(500).json({ message: 'Server error while fetching psychologists.' });
  }
};

/**
 * GET /api/escalations/assigned
 * Psychologist only - their own escalated cases. Optional ?status= filter.
 */
exports.getAssignedCases = async (req, res) => {
  try {
    const filter = { psychologist: req.user.id };

    if (req.query.status) {
      const allowed = CaseAssignment.schema.path('status').enumValues;
      if (!allowed.includes(req.query.status)) {
        return res.status(400).json({ message: 'Unknown status filter.' });
      }
      filter.status = req.query.status;
    }

    const assignments = await CaseAssignment.find(filter)
      .populate('request', 'category urgency description status createdAt')
      .populate('volunteer', 'name email')
      .sort({ createdAt: -1 });

    return res.json({ assignments });
  } catch (err) {
    return res.status(500).json({ message: 'Server error while fetching assigned cases.' });
  }
};

// Shared guard for the three psychologist decisions below.
async function loadOwnCase(req, res, allowedFrom) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ message: 'Invalid case id.' });
    return null;
  }

  const assignment = await CaseAssignment.findById(id);
  if (!assignment) {
    res.status(404).json({ message: 'Case not found.' });
    return null;
  }

  if (String(assignment.psychologist) !== String(req.user.id)) {
    res.status(403).json({ message: 'This case is not assigned to you.' });
    return null;
  }

  if (!allowedFrom.includes(assignment.status)) {
    res.status(409).json({ message: `This case is already ${assignment.status}.` });
    return null;
  }

  return assignment;
}

/** PATCH /api/escalations/:id/accept - psychologist only. */
exports.acceptCase = async (req, res) => {
  try {
    const assignment = await loadOwnCase(req, res, ['pending']);
    if (!assignment) return undefined;

    assignment.status = 'accepted';
    await assignment.save();

    return res.json({ message: 'Case accepted.', assignment });
  } catch (err) {
    return res.status(500).json({ message: 'Server error while accepting the case.' });
  }
};

/**
 * PATCH /api/escalations/:id/reject - psychologist only.
 * The request goes back to the volunteer so it is not left stranded.
 */
exports.rejectCase = async (req, res) => {
  try {
    const assignment = await loadOwnCase(req, res, ['pending']);
    if (!assignment) return undefined;

    assignment.status = 'rejected';
    await assignment.save();

    await CrisisRequest.findByIdAndUpdate(assignment.request, {
      status: REQUEST_STATUSES.ACCEPTED,
    });

    return res.json({ message: 'Case rejected and returned to the volunteer.', assignment });
  } catch (err) {
    return res.status(500).json({ message: 'Server error while rejecting the case.' });
  }
};

/** PATCH /api/escalations/:id/complete - psychologist only, closes the request. */
exports.completeCase = async (req, res) => {
  try {
    const assignment = await loadOwnCase(req, res, ['accepted']);
    if (!assignment) return undefined;

    assignment.status = 'completed';
    await assignment.save();

    await CrisisRequest.findByIdAndUpdate(assignment.request, { status: 'closed' });

    return res.json({ message: 'Case completed.', assignment });
  } catch (err) {
    return res.status(500).json({ message: 'Server error while completing the case.' });
  }
};
