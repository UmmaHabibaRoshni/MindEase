const mongoose = require('mongoose');

// Unit tests for the dashboard case list and status endpoints.
// Models are mocked over a small in-memory store, so no database runs.

const mockStore = { assignments: [], requests: [] };

const mockNewId = () => new (require('mongoose').Types.ObjectId)();
const mockById = (rows, id) => rows.find((r) => String(r._id) === String(id)) || null;

jest.mock('../models/CaseAssignment', () => {
  const statuses = ['pending', 'accepted', 'rejected', 'completed'];
  const matches = (a, f) =>
    String(a.psychologist) === String(f.psychologist) &&
    (f.status === undefined || a.status === f.status);

  return {
    schema: { path: () => ({ enumValues: statuses }) },
    countDocuments: jest.fn(async (filter) => mockStore.assignments.filter((a) => matches(a, filter)).length),
    findById: jest.fn((id) => {
      const row = mockById(mockStore.assignments, id);
      const chain = {
        populate: () => chain,
        then: (resolve, reject) => Promise.resolve(row).then(resolve, reject),
      };
      return chain;
    }),
    find: jest.fn((filter) => {
      let rows = mockStore.assignments.filter((a) => matches(a, filter));
      const chain = {
        populate: () => chain,
        sort: (spec) => {
          const [key, dir] = Object.entries(spec)[0];
          rows = [...rows].sort((a, b) => (a[key] > b[key] ? dir : a[key] < b[key] ? -dir : 0));
          return chain;
        },
        skip: (n) => {
          rows = rows.slice(n);
          return chain;
        },
        limit: (n) => {
          rows = rows.slice(0, n);
          return chain;
        },
        then: (resolve, reject) => Promise.resolve(rows).then(resolve, reject),
      };
      return chain;
    }),
  };
});

jest.mock('../models/CaseNote', () => ({
  schema: { path: () => ({ options: { maxlength: 5000 } }) },
  create: jest.fn(),
  find: jest.fn(() => ({ sort: async () => [] })),
}));

jest.mock('../models/CrisisRequest', () => ({
  findByIdAndUpdate: jest.fn(async (id, update) => {
    const row = mockById(mockStore.requests, id);
    if (row) Object.assign(row, update);
    return row;
  }),
}));

const CrisisRequest = require('../models/CrisisRequest');
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

const addCase = (status, { owner = psychologist, createdAt = new Date() } = {}) => {
  const request = { _id: mockNewId(), status: 'escalated' };
  mockStore.requests.push(request);

  const row = {
    _id: mockNewId(),
    psychologist: owner,
    volunteer: mockNewId(),
    request: request._id,
    summary: 'Handover summary for the case.',
    status,
    decisionReason: '',
    createdAt,
    save: async function save() {
      return this;
    },
  };
  mockStore.assignments.push(row);
  return row;
};

const list = async (query = {}, actor = psychologist) => {
  const res = mockRes();
  await controller.listCases({ query, user: { id: String(actor), role: 'psychologist' } }, res);
  return res;
};

const setStatus = async (id, body, actor = psychologist) => {
  const res = mockRes();
  await controller.updateCaseStatus(
    { params: { id: String(id) }, body, user: { id: String(actor), role: 'psychologist' } },
    res
  );
  return res;
};

beforeEach(() => {
  mockStore.assignments.length = 0;
  mockStore.requests.length = 0;
  jest.clearAllMocks();
});

describe('listCases', () => {
  it('returns an empty page when there are no cases', async () => {
    const res = await list();

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination).toEqual({ page: 1, limit: 20, total: 0, totalPages: 1 });
  });

  it('returns only the cases belonging to the caller', async () => {
    addCase('pending');
    addCase('accepted', { owner: other });

    const { body } = await list();

    expect(body.data).toHaveLength(1);
    expect(body.pagination.total).toBe(1);
  });

  it('filters by status', async () => {
    addCase('pending');
    addCase('accepted');

    expect((await list({ status: 'accepted' })).body.data).toHaveLength(1);
  });

  // The frontend sends capitalised statuses; the model stores them lowercase.
  it('accepts a capitalised status filter', async () => {
    addCase('accepted');

    expect((await list({ status: 'Accepted' })).body.data).toHaveLength(1);
  });

  it('treats "all" as no filter', async () => {
    addCase('pending');
    addCase('completed');

    expect((await list({ status: 'all' })).body.data).toHaveLength(2);
  });

  it('400s on an unknown status filter', async () => {
    expect((await list({ status: 'banana' })).statusCode).toBe(400);
  });

  it('paginates', async () => {
    for (let i = 0; i < 25; i += 1) addCase('pending');

    const first = await list({ page: 1, limit: 10 });
    const last = await list({ page: 3, limit: 10 });

    expect(first.body.data).toHaveLength(10);
    expect(last.body.data).toHaveLength(5);
    expect(last.body.pagination).toEqual({ page: 3, limit: 10, total: 25, totalPages: 3 });
  });

  it('falls back to sane paging values', async () => {
    const { body } = await list({ page: '-4', limit: '9999' });

    expect(body.pagination.page).toBe(1);
    expect(body.pagination.limit).toBe(100);
  });

  it('sorts newest first by default and oldest first on request', async () => {
    const older = addCase('pending', { createdAt: new Date('2026-01-01') });
    const newer = addCase('pending', { createdAt: new Date('2026-10-01') });

    const desc = await list();
    const asc = await list({ sortOrder: 'asc' });

    expect(String(desc.body.data[0]._id)).toBe(String(newer._id));
    expect(String(asc.body.data[0]._id)).toBe(String(older._id));
  });

  it('ignores a sort field that is not allowed', async () => {
    addCase('pending');

    expect((await list({ sortBy: 'summary' })).statusCode).toBe(200);
  });
});

describe('updateCaseStatus', () => {
  it('accepts a pending case', async () => {
    const c = addCase('pending');

    const res = await setStatus(c._id, { status: 'Accepted' });

    expect(res.statusCode).toBe(200);
    expect(c.status).toBe('accepted');
    expect(res.body.data.status).toBe('accepted');
  });

  it('rejects a pending case and hands the request back to the volunteer', async () => {
    const c = addCase('pending');

    await setStatus(c._id, { status: 'Rejected', decisionReason: 'Outside my specialism.' });

    expect(c.status).toBe('rejected');
    expect(c.decisionReason).toBe('Outside my specialism.');
    expect(CrisisRequest.findByIdAndUpdate).toHaveBeenCalledWith(c.request, { status: 'accepted' });
  });

  it('completes an accepted case and closes the request', async () => {
    const c = addCase('accepted');

    await setStatus(c._id, { status: 'completed' });

    expect(c.status).toBe('completed');
    expect(CrisisRequest.findByIdAndUpdate).toHaveBeenCalledWith(c.request, { status: 'closed' });
  });

  it('trims the decision reason and leaves it blank when only spaces are sent', async () => {
    const c = addCase('pending');

    await setStatus(c._id, { status: 'accepted', decisionReason: '   ' });

    expect(c.decisionReason).toBe('');
  });

  it.each(['pending', 'banana', '', undefined])('400s on the status %o', async (status) => {
    const c = addCase('pending');

    const res = await setStatus(c._id, { status });

    expect(res.statusCode).toBe(400);
    expect(c.status).toBe('pending');
  });

  it('409s when the transition is not allowed', async () => {
    const c = addCase('pending');

    const res = await setStatus(c._id, { status: 'completed' });

    expect(res.statusCode).toBe(409);
    expect(c.status).toBe('pending');
  });

  it('409s when the case was already decided', async () => {
    const c = addCase('accepted');

    expect((await setStatus(c._id, { status: 'accepted' })).statusCode).toBe(409);
  });

  it('403s when the case belongs to another psychologist', async () => {
    const c = addCase('pending', { owner: other });

    const res = await setStatus(c._id, { status: 'accepted' });

    expect(res.statusCode).toBe(403);
    expect(c.status).toBe('pending');
  });

  it('400s on an invalid id', async () => {
    expect((await setStatus('nope', { status: 'accepted' })).statusCode).toBe(400);
  });

  it('404s when the case does not exist', async () => {
    const res = await setStatus(new mongoose.Types.ObjectId(), { status: 'accepted' });

    expect(res.statusCode).toBe(404);
  });
});
