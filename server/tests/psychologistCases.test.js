const mongoose = require('mongoose');

// T13.6 (notes half) - unit tests for the case detail and private notes APIs.
// The models are mocked over a small in-memory store, so no database runs.

const mockStore = { assignments: [], notes: [] };

const mockNewId = () => new (require('mongoose').Types.ObjectId)();

const mockById = (rows, id) => rows.find((r) => String(r._id) === String(id)) || null;

jest.mock('../models/CaseAssignment', () => ({
  schema: { path: () => ({ enumValues: ['pending', 'accepted', 'rejected', 'completed'] }) },
  countDocuments: jest.fn(async () => 0),
  // findById(...).populate(...).populate(...) must be awaitable either way.
  findById: jest.fn((id) => {
    const row = mockById(mockStore.assignments, id);
    const chain = {
      populate: () => chain,
      then: (resolve, reject) => Promise.resolve(row).then(resolve, reject),
    };
    return chain;
  }),
}));

jest.mock('../models/CaseNote', () => ({
  schema: { path: () => ({ options: { maxlength: 5000 } }) },
  create: jest.fn(async (data) => {
    const note = { _id: mockNewId(), createdAt: new Date(), ...data };
    mockStore.notes.push(note);
    return note;
  }),
  find: jest.fn((filter) => ({
    sort: async () =>
      mockStore.notes
        .filter(
          (n) =>
            String(n.assignment) === String(filter.assignment) &&
            String(n.psychologist) === String(filter.psychologist)
        )
        .sort((a, b) => b.createdAt - a.createdAt),
  })),
}));

const CaseNote = require('../models/CaseNote');
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
const volunteer = new mongoose.Types.ObjectId();

let assignment;

const invoke = async (fn, { id, body = {}, actor = psychologist } = {}) => {
  const res = mockRes();
  await controller[fn](
    {
      params: { id: id === undefined ? String(assignment._id) : id },
      body,
      user: { id: String(actor), role: 'psychologist' },
    },
    res
  );
  return res;
};

beforeEach(() => {
  mockStore.assignments.length = 0;
  mockStore.notes.length = 0;
  jest.clearAllMocks();

  assignment = {
    _id: mockNewId(),
    psychologist,
    volunteer,
    request: { category: 'mental_health', urgency: 'high', description: 'Needs follow-up.' },
    summary: 'Seeker needs clinical follow-up for persistent insomnia.',
    status: 'accepted',
  };
  mockStore.assignments.push(assignment);
});

describe('getCaseDetail (T13.4)', () => {
  it('returns the case with the request and volunteer expanded', async () => {
    const res = await invoke('getCaseDetail');

    expect(res.statusCode).toBe(200);
    expect(res.body.case.summary).toBe(assignment.summary);
    expect(res.body.case.request.category).toBe('mental_health');
  });

  it('400s on an invalid id', async () => {
    expect((await invoke('getCaseDetail', { id: 'nope' })).statusCode).toBe(400);
  });

  it('404s when the case does not exist', async () => {
    const res = await invoke('getCaseDetail', { id: String(new mongoose.Types.ObjectId()) });

    expect(res.statusCode).toBe(404);
  });

  it('403s when the case belongs to another psychologist', async () => {
    const res = await invoke('getCaseDetail', { actor: other });

    expect(res.statusCode).toBe(403);
  });
});

describe('addCaseNote (T13.4)', () => {
  it('saves a note against the case', async () => {
    const res = await invoke('addCaseNote', { body: { text: 'Called the seeker today.' } });

    expect(res.statusCode).toBe(201);
    expect(mockStore.notes).toHaveLength(1);
    expect(mockStore.notes[0].text).toBe('Called the seeker today.');
    expect(String(mockStore.notes[0].assignment)).toBe(String(assignment._id));
    expect(String(mockStore.notes[0].psychologist)).toBe(String(psychologist));
  });

  it('trims the note before saving', async () => {
    await invoke('addCaseNote', { body: { text: '   spaced out   ' } });

    expect(mockStore.notes[0].text).toBe('spaced out');
  });

  it.each(['', '   ', undefined])('400s on the empty note %o', async (text) => {
    const res = await invoke('addCaseNote', { body: { text } });

    expect(res.statusCode).toBe(400);
    expect(mockStore.notes).toHaveLength(0);
  });

  it('400s on a note longer than the model allows', async () => {
    const res = await invoke('addCaseNote', { body: { text: 'x'.repeat(5001) } });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/5000/);
    expect(CaseNote.create).not.toHaveBeenCalled();
  });

  it('accepts a note of exactly the maximum length', async () => {
    const res = await invoke('addCaseNote', { body: { text: 'x'.repeat(5000) } });

    expect(res.statusCode).toBe(201);
  });

  it('403s when the case belongs to another psychologist', async () => {
    const res = await invoke('addCaseNote', { body: { text: 'Not mine.' }, actor: other });

    expect(res.statusCode).toBe(403);
    expect(mockStore.notes).toHaveLength(0);
  });

  it('404s when the case does not exist', async () => {
    const res = await invoke('addCaseNote', {
      id: String(new mongoose.Types.ObjectId()),
      body: { text: 'Nowhere to go.' },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('listCaseNotes (T13.4)', () => {
  const addNote = (text, minutesAgo, owner = psychologist) =>
    mockStore.notes.push({
      _id: mockNewId(),
      assignment: assignment._id,
      psychologist: owner,
      text,
      createdAt: new Date(Date.now() - minutesAgo * 60000),
    });

  it('returns an empty list when nothing has been written', async () => {
    const res = await invoke('listCaseNotes');

    expect(res.statusCode).toBe(200);
    expect(res.body.notes).toEqual([]);
    expect(res.body.count).toBe(0);
  });

  it('returns the notes newest first', async () => {
    addNote('oldest', 30);
    addNote('newest', 1);
    addNote('middle', 10);

    const { body } = await invoke('listCaseNotes');

    expect(body.count).toBe(3);
    expect(body.notes.map((n) => n.text)).toEqual(['newest', 'middle', 'oldest']);
  });

  // The sprint sheet calls these "private text" - they are not shared.
  it('never returns another psychologist notes', async () => {
    addNote('mine', 5);
    addNote('theirs', 5, other);

    const { body } = await invoke('listCaseNotes');

    expect(body.count).toBe(1);
    expect(body.notes[0].text).toBe('mine');
  });

  it('403s when the case belongs to another psychologist', async () => {
    expect((await invoke('listCaseNotes', { actor: other })).statusCode).toBe(403);
  });

  it('400s on an invalid id', async () => {
    expect((await invoke('listCaseNotes', { id: 'nope' })).statusCode).toBe(400);
  });
});
