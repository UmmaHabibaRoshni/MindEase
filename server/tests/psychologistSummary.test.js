const mongoose = require('mongoose');

// T13.6 (summary half) - unit tests for the psychologist dashboard summary API.
// CaseAssignment is mocked over a small in-memory store, so no database runs.

const mockStore = { assignments: [] };

const mockStatuses = ['pending', 'accepted', 'rejected', 'completed'];

jest.mock('../models/CaseAssignment', () => ({
  schema: { path: () => ({ enumValues: mockStatuses }) },
  countDocuments: jest.fn(async (query) =>
    mockStore.assignments.filter(
      (a) =>
        String(a.psychologist) === String(query.psychologist) && a.status === query.status
    ).length
  ),
}));

const CaseAssignment = require('../models/CaseAssignment');
const controller = require('../controllers/psychologistController');

const mockRes = () => ({
  statusCode: 200,
  body: undefined,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

const psychologist = new mongoose.Types.ObjectId();
const other = new mongoose.Types.ObjectId();

const addCase = (status, owner = psychologist) =>
  mockStore.assignments.push({ _id: new mongoose.Types.ObjectId(), psychologist: owner, status });

const callSummary = async (actor = psychologist) => {
  const res = mockRes();
  await controller.getDashboardSummary({ user: { id: String(actor), role: 'psychologist' } }, res);
  return res;
};

beforeEach(() => {
  mockStore.assignments.length = 0;
  jest.clearAllMocks();
});

describe('getDashboardSummary (T13.5)', () => {
  it('returns zero for every status when there are no cases', async () => {
    const res = await callSummary();

    expect(res.statusCode).toBe(200);
    expect(res.body.summary).toEqual({
      pending: 0,
      accepted: 0,
      rejected: 0,
      completed: 0,
      total: 0,
    });
  });

  it('counts each status separately', async () => {
    addCase('pending');
    addCase('pending');
    addCase('accepted');
    addCase('completed');
    addCase('completed');
    addCase('completed');

    const { body } = await callSummary();

    expect(body.summary.pending).toBe(2);
    expect(body.summary.accepted).toBe(1);
    expect(body.summary.completed).toBe(3);
    expect(body.summary.rejected).toBe(0);
  });

  it('totals every case', async () => {
    addCase('pending');
    addCase('accepted');
    addCase('rejected');
    addCase('completed');

    const { body } = await callSummary();

    expect(body.summary.total).toBe(4);
  });

  it('never counts another psychologist cases', async () => {
    addCase('pending');
    addCase('accepted', other);
    addCase('completed', other);

    const { body } = await callSummary();

    expect(body.summary.pending).toBe(1);
    expect(body.summary.accepted).toBe(0);
    expect(body.summary.total).toBe(1);
  });

  it('reports a count for every status the model allows', async () => {
    const { body } = await callSummary();

    mockStatuses.forEach((status) => {
      expect(body.summary).toHaveProperty(status);
    });
  });

  it('queries only the logged-in psychologist cases', async () => {
    await callSummary();

    expect(CaseAssignment.countDocuments).toHaveBeenCalledTimes(mockStatuses.length);
    CaseAssignment.countDocuments.mock.calls.forEach(([query]) => {
      expect(String(query.psychologist)).toBe(String(psychologist));
    });
  });

  it('returns a 500 instead of throwing when the count fails', async () => {
    CaseAssignment.countDocuments.mockRejectedValueOnce(new Error('db down'));

    const res = await callSummary();

    expect(res.statusCode).toBe(500);
    expect(res.body.message).toMatch(/dashboard summary/i);
  });
});
