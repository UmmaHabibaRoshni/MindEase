const mongoose = require('mongoose');

// T9.6 - unit tests for the escalation APIs (BL-9).
// The models are mocked over a small in-memory mockStore, in the same style as
// seedAdmin.test.js, so the suite needs no running MongoDB. The real query and
// populate behaviour is covered by the Thunder Client run in docs/qa.

const mockNewId = () => new (require('mongoose').Types.ObjectId)();

const mockStore = { assignments: [], requests: [], users: [] };

const mockById = (rows, id) => rows.find((r) => String(r._id) === String(id)) || null;

// find(...) in the controllers is always followed by chained helpers, so the
// mock returns a thenable mockChain instead of a bare array.
const mockChain = (rows) => {
  const link = {
    populate: () => link,
    select: () => link,
    sort: () => Promise.resolve(rows),
    then: (resolve) => Promise.resolve(rows).then(resolve),
  };
  return link;
};

jest.mock('../models/CaseAssignment', () => ({
  schema: { path: () => ({ enumValues: ['pending', 'accepted', 'rejected', 'completed'] }) },
  create: jest.fn(async (data) => {
    const doc = { _id: mockNewId(), status: 'pending', ...data, save: async () => doc };
    mockStore.assignments.push(doc);
    return doc;
  }),
  findById: jest.fn(async (id) => mockById(mockStore.assignments, id)),
  findOne: jest.fn(async (query) => {
    return (
      mockStore.assignments.find(
        (a) =>
          String(a.request) === String(query.request) &&
          (!query.status ? true : query.status.$in.includes(a.status))
      ) || null
    );
  }),
  // Cases are returned with request/volunteer already expanded, which is what
  // the chained .populate() calls produce against a real connection.
  find: jest.fn((filter) =>
    mockChain(
      mockStore.assignments
        .filter(
          (a) =>
            String(a.psychologist) === String(filter.psychologist) &&
            (filter.status === undefined || a.status === filter.status)
        )
        .map((a) => ({ ...a, request: mockById(mockStore.requests, a.request), volunteer: mockById(mockStore.users, a.volunteer) }))
    )
  ),
}));

jest.mock('../models/CrisisRequest', () => ({
  findById: jest.fn(async (id) => mockById(mockStore.requests, id)),
  findByIdAndUpdate: jest.fn(async (id, update) => {
    const doc = mockById(mockStore.requests, id);
    if (doc) Object.assign(doc, update);
    return doc;
  }),
}));

jest.mock('../models/User', () => ({
  findById: jest.fn(async (id) => mockById(mockStore.users, id)),
  find: jest.fn((filter) =>
    mockChain(
      mockStore.users
        .filter((u) => u.role === filter.role && u.status === filter.status)
        .map((u) => ({ _id: u._id, name: u.name, email: u.email }))
        .sort((a, b) => a.name.localeCompare(b.name))
    )
  ),
}));

const CaseAssignment = require('../models/CaseAssignment');
const CrisisRequest = require('../models/CrisisRequest');
const controller = require('../controllers/escalationController');

// Minimal express-like res that records what the controller sent.
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

let counter = 0;

const addUser = (role, status = 'approved') => {
  counter += 1;
  const user = {
    _id: new mongoose.Types.ObjectId(),
    name: `${role}-${counter}`,
    email: `${role}${counter}@test.com`,
    password: 'hashed',
    role,
    status,
  };
  mockStore.users.push(user);
  return user;
};

const addRequest = (seeker, overrides = {}) => {
  const doc = {
    _id: new mongoose.Types.ObjectId(),
    seeker: seeker._id,
    category: 'mental_health',
    description: 'I have been struggling to sleep for several weeks now.',
    urgency: 'high',
    status: 'pending',
    acceptedBy: null,
    ...overrides,
    save: async () => doc,
  };
  mockStore.requests.push(doc);
  return doc;
};

const addAssignment = (data) => {
  const doc = { _id: mockNewId(), status: 'pending', ...data, save: async () => doc };
  mockStore.assignments.push(doc);
  return doc;
};

const SUMMARY = 'Seeker needs clinical follow-up for persistent insomnia.';

beforeEach(() => {
  mockStore.assignments.length = 0;
  mockStore.requests.length = 0;
  mockStore.users.length = 0;
  jest.clearAllMocks();
});

describe('createEscalation (T9.4)', () => {
  let volunteer;
  let psychologist;
  let request;

  beforeEach(() => {
    volunteer = addUser('volunteer');
    psychologist = addUser('psychologist');
    request = addRequest(addUser('seeker'), { status: 'accepted', acceptedBy: volunteer._id });
  });

  const call = async (body, actor = volunteer) => {
    const res = mockRes();
    await controller.createEscalation({ body, user: { id: String(actor._id), role: actor.role } }, res);
    return res;
  };

  const validBody = () => ({
    requestId: String(request._id),
    psychologistId: String(psychologist._id),
    summary: SUMMARY,
  });

  it('creates the case and escalates the request', async () => {
    const res = await call(validBody());

    expect(res.statusCode).toBe(201);
    expect(res.body.assignment.status).toBe('pending');
    expect(String(res.body.assignment.volunteer)).toBe(String(volunteer._id));
    expect(mockStore.assignments).toHaveLength(1);
    expect(mockStore.assignments[0].summary).toBe(SUMMARY);
    expect(request.status).toBe('escalated');
  });

  it('trims the summary before saving', async () => {
    await call({ ...validBody(), summary: `   ${SUMMARY}   ` });

    expect(mockStore.assignments[0].summary).toBe(SUMMARY);
  });

  it.each(['nope', '', undefined])('400s on the malformed requestId %o', async (requestId) => {
    const res = await call({ ...validBody(), requestId });

    expect(res.statusCode).toBe(400);
    expect(mockStore.assignments).toHaveLength(0);
  });

  it.each(['too short', '   ', undefined])('400s on the summary %o', async (summary) => {
    const res = await call({ ...validBody(), summary });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/at least 20 characters/);
  });

  it('404s when the request does not exist', async () => {
    const res = await call({ ...validBody(), requestId: String(new mongoose.Types.ObjectId()) });

    expect(res.statusCode).toBe(404);
  });

  it('403s when another volunteer owns the request', async () => {
    const res = await call(validBody(), addUser('volunteer'));

    expect(res.statusCode).toBe(403);
    expect(mockStore.assignments).toHaveLength(0);
    expect(request.status).toBe('accepted');
  });

  it('409s when the request is still pending', async () => {
    request.status = 'pending';

    const res = await call(validBody());

    expect(res.statusCode).toBe(409);
    expect(mockStore.assignments).toHaveLength(0);
  });

  it('404s when the target is not a psychologist', async () => {
    const res = await call({ ...validBody(), psychologistId: String(addUser('ngo')._id) });

    expect(res.statusCode).toBe(404);
  });

  it('400s when the psychologist is still pending approval', async () => {
    const unapproved = addUser('psychologist', 'pending');

    const res = await call({ ...validBody(), psychologistId: String(unapproved._id) });

    expect(res.statusCode).toBe(400);
    expect(mockStore.assignments).toHaveLength(0);
  });

  it('409s on a double escalation', async () => {
    await call(validBody());
    request.status = 'accepted'; // pretend it was reopened

    const res = await call(validBody());

    expect(res.statusCode).toBe(409);
    expect(mockStore.assignments).toHaveLength(1);
  });

  it('allows re-escalation after a rejection', async () => {
    await call(validBody());
    mockStore.assignments[0].status = 'rejected';
    request.status = 'accepted';

    const res = await call(validBody());

    expect(res.statusCode).toBe(201);
    expect(mockStore.assignments).toHaveLength(2);
  });

  it('returns a 500 instead of throwing when the lookup fails', async () => {
    CrisisRequest.findById.mockRejectedValueOnce(new Error('db down'));

    const res = await call(validBody());

    expect(res.statusCode).toBe(500);
  });
});

describe('getPsychologists (T9.4)', () => {
  it('returns only approved psychologists and never the password', async () => {
    addUser('psychologist');
    addUser('psychologist', 'pending');
    addUser('volunteer');

    const res = mockRes();
    await controller.getPsychologists({}, res);

    expect(res.body.psychologists).toHaveLength(1);
    expect(res.body.psychologists[0].password).toBeUndefined();
  });
});

describe('psychologist case APIs (T9.5)', () => {
  let volunteer;
  let psychologist;
  let request;
  let assignment;

  beforeEach(() => {
    volunteer = addUser('volunteer');
    psychologist = addUser('psychologist');
    request = addRequest(addUser('seeker'), { status: 'escalated', acceptedBy: volunteer._id });
    assignment = addAssignment({
      request: request._id,
      volunteer: volunteer._id,
      psychologist: psychologist._id,
      summary: SUMMARY,
    });
  });

  const invoke = async (fn, { id, query = {}, actor = psychologist } = {}) => {
    const res = mockRes();
    await controller[fn](
      {
        params: { id: id === undefined ? String(assignment._id) : id },
        query,
        user: { id: String(actor._id), role: actor.role },
      },
      res
    );
    return res;
  };

  describe('getAssignedCases', () => {
    it('returns the cases for the logged-in psychologist with the request expanded', async () => {
      const res = await invoke('getAssignedCases');

      expect(res.body.assignments).toHaveLength(1);
      expect(res.body.assignments[0].request.category).toBe('mental_health');
      expect(res.body.assignments[0].volunteer.name).toBe(volunteer.name);
    });

    it('does not leak another psychologist cases', async () => {
      const res = await invoke('getAssignedCases', { actor: addUser('psychologist') });

      expect(res.body.assignments).toHaveLength(0);
    });

    it('filters by status', async () => {
      expect((await invoke('getAssignedCases', { query: { status: 'accepted' } })).body.assignments).toHaveLength(0);

      assignment.status = 'accepted';

      expect((await invoke('getAssignedCases', { query: { status: 'accepted' } })).body.assignments).toHaveLength(1);
    });

    it('400s on an unknown status filter', async () => {
      const res = await invoke('getAssignedCases', { query: { status: 'banana' } });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('acceptCase', () => {
    it('moves the case to accepted', async () => {
      const res = await invoke('acceptCase');

      expect(res.statusCode).toBe(200);
      expect(assignment.status).toBe('accepted');
    });

    it('400s on an invalid id', async () => {
      expect((await invoke('acceptCase', { id: 'nope' })).statusCode).toBe(400);
    });

    it('404s on a missing case', async () => {
      const res = await invoke('acceptCase', { id: String(new mongoose.Types.ObjectId()) });

      expect(res.statusCode).toBe(404);
    });

    it('403s when the case belongs to someone else', async () => {
      const res = await invoke('acceptCase', { actor: addUser('psychologist') });

      expect(res.statusCode).toBe(403);
      expect(assignment.status).toBe('pending');
    });

    it('409s when the case was already accepted', async () => {
      await invoke('acceptCase');

      expect((await invoke('acceptCase')).statusCode).toBe(409);
    });
  });

  describe('rejectCase', () => {
    it('rejects the case and hands the request back to the volunteer', async () => {
      const res = await invoke('rejectCase');

      expect(res.statusCode).toBe(200);
      expect(assignment.status).toBe('rejected');
      expect(request.status).toBe('accepted');
    });

    it('409s once the case is accepted', async () => {
      await invoke('acceptCase');

      expect((await invoke('rejectCase')).statusCode).toBe(409);
      expect(request.status).toBe('escalated');
    });
  });

  describe('completeCase', () => {
    it('completes an accepted case and closes the request', async () => {
      await invoke('acceptCase');

      const res = await invoke('completeCase');

      expect(res.statusCode).toBe(200);
      expect(assignment.status).toBe('completed');
      expect(request.status).toBe('closed');
    });

    it('409s when the case has not been accepted yet', async () => {
      const res = await invoke('completeCase');

      expect(res.statusCode).toBe(409);
      expect(request.status).toBe('escalated');
    });

    it('returns a 500 instead of throwing when the save fails', async () => {
      await invoke('acceptCase');
      CaseAssignment.findById.mockRejectedValueOnce(new Error('db down'));

      expect((await invoke('completeCase')).statusCode).toBe(500);
    });
  });
});

