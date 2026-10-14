// T14.6 - unit tests for the NGO referral APIs and the NGO role guard (BL-14).
// The models are mocked, in the same style as adminController.test.js, so the
// suite needs no running MongoDB. Real query behaviour is covered by the
// Thunder Client run (T14.10).

jest.mock('../models/Referral', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  REFERRAL_STATUSES: ['pending', 'in_progress', 'resolved', 'closed'],
  RESPONDED_STATUSES: ['in_progress', 'resolved', 'closed'],
  NOTE_MAX: 1000,
}));
jest.mock('../models/Ngo', () => ({ findOne: jest.fn(), findById: jest.fn() }));
jest.mock('../models/User', () => ({ findOne: jest.fn() }));
jest.mock('../models/CrisisRequest', () => ({}));

const Referral = require('../models/Referral');
const Ngo = require('../models/Ngo');
const allowRoles = require('../middleware/role');
const {
  getNgoReferrals,
  getNgoReferral,
  updateReferralStatus,
} = require('../controllers/referralController');

const STATUSES = ['pending', 'in_progress', 'resolved', 'closed'];

const ngoUserId = '507f1f77bcf86cd799439011';
const ngoId = '507f1f77bcf86cd799439012';
const referralId = '507f1f77bcf86cd799439013';
const requestId = '507f1f77bcf86cd799439014';
const otherUserId = '507f1f77bcf86cd799439015';

let errorSpy;

beforeEach(() => {
  jest.resetAllMocks();
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const ngoReq = (overrides = {}) => ({
  user: { id: ngoUserId, role: 'ngo', status: 'approved' },
  query: {},
  body: {},
  params: {},
  ...overrides,
});

// Referral.find(...) is followed by .populate().select().sort()
function mockFindChain(rows) {
  const chain = {
    populate: jest.fn(),
    select: jest.fn(),
    sort: jest.fn().mockResolvedValue(rows),
  };
  chain.populate.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  Referral.find.mockReturnValue(chain);
  return chain;
}

// Referral.findOne(...) in getNgoReferral is followed by .populate().select()
function mockFindOneChain(doc) {
  const chain = {
    populate: jest.fn(),
    select: jest.fn().mockResolvedValue(doc),
  };
  chain.populate.mockReturnValue(chain);
  Referral.findOne.mockReturnValue(chain);
  return chain;
}

function fakeReferral(overrides = {}) {
  return {
    _id: referralId,
    request: requestId,
    ngo: ngoId,
    status: 'pending',
    note: '',
    respondedAt: null,
    respondedBy: null,
    createdAt: new Date('2026-10-12T09:30:00.000Z'),
    updatedAt: new Date('2026-10-14T05:00:00.000Z'),
    populate: jest.fn().mockResolvedValue(undefined),
    // Stand-in for the model's pre("validate") hook (T14.1).
    save: jest.fn(async function save() {
      const answered = this.status !== 'pending';
      if (answered && !this.respondedAt) this.respondedAt = new Date();
      if (!answered) {
        this.respondedAt = null;
        this.respondedBy = null;
      }
    }),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// T14.4  GET /api/referrals/mine
// ---------------------------------------------------------------------------
describe('getNgoReferrals (T14.4)', () => {
  beforeEach(() => {
    Ngo.findOne.mockResolvedValue({ _id: ngoId });
  });

  test("finds the NGO from the logged-in user and lists only that NGO's referrals", async () => {
    const rows = [{ _id: 'r1' }, { _id: 'r2' }];
    const chain = mockFindChain(rows);
    const res = mockRes();

    await getNgoReferrals(ngoReq(), res);

    expect(Ngo.findOne).toHaveBeenCalledWith({ user: ngoUserId });
    expect(Referral.find).toHaveBeenCalledWith({ ngo: ngoId });
    expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(res.json).toHaveBeenCalledWith({ count: 2, referrals: rows });
  });

  test('returns an empty list when there are no referrals', async () => {
    mockFindChain([]);
    const res = mockRes();

    await getNgoReferrals(ngoReq(), res);

    expect(res.json).toHaveBeenCalledWith({ count: 0, referrals: [] });
  });

  test.each(STATUSES)('filters by status=%s', async (status) => {
    mockFindChain([]);
    const res = mockRes();

    await getNgoReferrals(ngoReq({ query: { status } }), res);

    expect(Referral.find).toHaveBeenCalledWith({ ngo: ngoId, status });
    expect(res.status).not.toHaveBeenCalled();
  });

  test('treats an empty status as no filter', async () => {
    mockFindChain([]);
    const res = mockRes();

    await getNgoReferrals(ngoReq({ query: { status: '' } }), res);

    expect(Referral.find).toHaveBeenCalledWith({ ngo: ngoId });
  });

  test('returns 400 for a status that does not exist', async () => {
    const res = mockRes();

    await getNgoReferrals(ngoReq({ query: { status: 'maybe_later' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Referral.find).not.toHaveBeenCalled();
  });

  test('returns 400 when status is sent more than once (array)', async () => {
    const res = mockRes();

    await getNgoReferrals(ngoReq({ query: { status: ['pending', 'closed'] } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Referral.find).not.toHaveBeenCalled();
  });

  test('never selects or populates the seeker identity', async () => {
    const chain = mockFindChain([]);

    await getNgoReferrals(ngoReq(), mockRes());

    const populateFields = chain.populate.mock.calls[0][1];
    const selectedFields = chain.select.mock.calls[0][0];
    expect(chain.populate).toHaveBeenCalledWith('request', 'category description urgency');
    expect(populateFields).not.toMatch(/seeker/);
    expect(selectedFields).not.toMatch(/seeker|referredBy|consent/);
    expect(selectedFields).toMatch(/note/);
    expect(selectedFields).toMatch(/respondedAt/);
  });

  test('returns 403 for an account that is not approved', async () => {
    const res = mockRes();
    const req = ngoReq({ user: { id: ngoUserId, role: 'ngo', status: 'pending' } });

    await getNgoReferrals(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Ngo.findOne).not.toHaveBeenCalled();
  });

  test('returns 404 when the user has no NGO profile', async () => {
    Ngo.findOne.mockResolvedValue(null);
    const res = mockRes();

    await getNgoReferrals(ngoReq(), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(Referral.find).not.toHaveBeenCalled();
  });

  test('returns 500 when the database fails', async () => {
    Referral.find.mockImplementation(() => {
      throw new Error('db down');
    });
    const res = mockRes();

    await getNgoReferrals(ngoReq(), res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ---------------------------------------------------------------------------
// GET /api/referrals/:id  (used by the T14.8 referral page)
// ---------------------------------------------------------------------------
describe('getNgoReferral (GET /api/referrals/:id)', () => {
  beforeEach(() => {
    Ngo.findOne.mockResolvedValue({ _id: ngoId });
  });

  const getReq = (id = referralId, overrides = {}) => ngoReq({ params: { id }, ...overrides });

  test("returns one referral, scoped to this NGO's own referrals", async () => {
    const doc = { _id: referralId, status: 'pending', note: '' };
    mockFindOneChain(doc);
    const res = mockRes();

    await getNgoReferral(getReq(), res);

    expect(Ngo.findOne).toHaveBeenCalledWith({ user: ngoUserId });
    expect(Referral.findOne).toHaveBeenCalledWith({ _id: referralId, ngo: ngoId });
    expect(res.json).toHaveBeenCalledWith({ referral: doc });
    expect(res.status).not.toHaveBeenCalled();
  });

  test('expands the request and never selects the seeker identity', async () => {
    const chain = mockFindOneChain({ _id: referralId });

    await getNgoReferral(getReq(), mockRes());

    const selectedFields = chain.select.mock.calls[0][0];
    expect(chain.populate).toHaveBeenCalledWith('request', 'category description urgency');
    expect(selectedFields).not.toMatch(/seeker|referredBy|consent/);
    expect(selectedFields).toMatch(/note/);
    expect(selectedFields).toMatch(/respondedAt/);
  });

  test("returns 404 for another NGO's referral", async () => {
    mockFindOneChain(null);
    const res = mockRes();

    await getNgoReferral(getReq(), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns 400 for an invalid referral id', async () => {
    const res = mockRes();

    await getNgoReferral(getReq('not-an-id'), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Referral.findOne).not.toHaveBeenCalled();
  });

  test('returns 404 when the user has no NGO profile', async () => {
    Ngo.findOne.mockResolvedValue(null);
    const res = mockRes();

    await getNgoReferral(getReq(), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(Referral.findOne).not.toHaveBeenCalled();
  });

  test('returns 403 for an account that is not approved', async () => {
    const res = mockRes();

    await getNgoReferral(getReq(referralId, { user: { id: ngoUserId, role: 'ngo', status: 'pending' } }), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Ngo.findOne).not.toHaveBeenCalled();
  });

  test('returns 500 when the database fails', async () => {
    Referral.findOne.mockImplementation(() => {
      throw new Error('db down');
    });
    const res = mockRes();

    await getNgoReferral(getReq(), res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ---------------------------------------------------------------------------
// T14.5  PATCH /api/referrals/:id/status
// ---------------------------------------------------------------------------
describe('updateReferralStatus (T14.5)', () => {
  beforeEach(() => {
    Ngo.findOne.mockResolvedValue({ _id: ngoId });
  });

  const patchReq = (body, overrides = {}) =>
    ngoReq({ params: { id: referralId }, body, ...overrides });

  test("only looks at this NGO's own referral", async () => {
    Referral.findOne.mockResolvedValue(fakeReferral());

    await updateReferralStatus(patchReq({ status: 'in_progress' }), mockRes());

    expect(Referral.findOne).toHaveBeenCalledWith({ _id: referralId, ngo: ngoId });
  });

  test('saves the new status and note, and stamps respondedAt and respondedBy', async () => {
    const referral = fakeReferral();
    Referral.findOne.mockResolvedValue(referral);
    const res = mockRes();

    await updateReferralStatus(
      patchReq({ status: 'in_progress', note: 'We have contacted the seeker.' }),
      res
    );

    expect(referral.status).toBe('in_progress');
    expect(referral.note).toBe('We have contacted the seeker.');
    expect(referral.respondedBy).toBe(ngoUserId);
    expect(referral.save).toHaveBeenCalledTimes(1);
    expect(referral.respondedAt).toBeInstanceOf(Date);

    const body = res.json.mock.calls[0][0];
    expect(body.message).toBe('Status updated');
    expect(body.referral.status).toBe('in_progress');
    expect(body.referral.note).toBe('We have contacted the seeker.');
    expect(body.referral.respondedAt).toBeInstanceOf(Date);
    expect(body.referral.save).toBeUndefined();
  });

  test('sends the request back expanded, with createdAt, after saving', async () => {
    const referral = fakeReferral();
    Referral.findOne.mockResolvedValue(referral);
    const res = mockRes();

    await updateReferralStatus(patchReq({ status: 'in_progress' }), res);

    expect(referral.populate).toHaveBeenCalledWith('request', 'category description urgency');
    expect(referral.save.mock.calls.length).toBe(1);
    const body = res.json.mock.calls[0][0];
    expect(body.referral.createdAt).toEqual(new Date('2026-10-12T09:30:00.000Z'));
  });

  test('works with a status alone, without a note', async () => {
    const referral = fakeReferral();
    Referral.findOne.mockResolvedValue(referral);
    const res = mockRes();

    await updateReferralStatus(patchReq({ status: 'resolved' }), res);

    expect(referral.status).toBe('resolved');
    expect(referral.note).toBe('');
    expect(res.status).not.toHaveBeenCalled();
  });

  test('trims whitespace around the note', async () => {
    const referral = fakeReferral();
    Referral.findOne.mockResolvedValue(referral);

    await updateReferralStatus(patchReq({ status: 'in_progress', note: '   Case opened.   ' }), mockRes());

    expect(referral.note).toBe('Case opened.');
  });

  test('keeps the existing note when no note is sent', async () => {
    const referral = fakeReferral({ status: 'in_progress', note: 'Earlier note' });
    Referral.findOne.mockResolvedValue(referral);

    await updateReferralStatus(patchReq({ status: 'resolved' }), mockRes());

    expect(referral.note).toBe('Earlier note');
  });

  test('clears the note when an empty note is sent', async () => {
    const referral = fakeReferral({ status: 'in_progress', note: 'Earlier note' });
    Referral.findOne.mockResolvedValue(referral);

    await updateReferralStatus(patchReq({ status: 'resolved', note: '' }), mockRes());

    expect(referral.note).toBe('');
  });

  test('accepts a note of exactly 1000 characters', async () => {
    const referral = fakeReferral();
    Referral.findOne.mockResolvedValue(referral);
    const res = mockRes();

    await updateReferralStatus(patchReq({ status: 'closed', note: 'x'.repeat(1000) }), res);

    expect(res.status).not.toHaveBeenCalled();
    expect(referral.save).toHaveBeenCalled();
  });

  test('keeps the first NGO user as respondedBy', async () => {
    const referral = fakeReferral({
      status: 'in_progress',
      respondedAt: new Date('2026-10-01T10:00:00.000Z'),
      respondedBy: otherUserId,
    });
    Referral.findOne.mockResolvedValue(referral);

    await updateReferralStatus(patchReq({ status: 'resolved' }), mockRes());

    expect(referral.respondedBy).toBe(otherUserId);
    expect(referral.respondedAt).toEqual(new Date('2026-10-01T10:00:00.000Z'));
  });

  test('moving back to pending clears the response', async () => {
    const referral = fakeReferral({
      status: 'resolved',
      respondedAt: new Date('2026-10-01T10:00:00.000Z'),
      respondedBy: ngoUserId,
    });
    Referral.findOne.mockResolvedValue(referral);
    const res = mockRes();

    await updateReferralStatus(patchReq({ status: 'pending' }), res);

    expect(referral.status).toBe('pending');
    expect(referral.respondedAt).toBeNull();
    expect(referral.respondedBy).toBeNull();
    expect(res.json.mock.calls[0][0].referral.respondedAt).toBeNull();
  });

  test.each([
    ['a status that does not exist', { status: 'maybe_later' }],
    ['a missing status', { note: 'only a note' }],
    ['an empty body', {}],
    ['a status that is not text', { status: { $ne: 'pending' } }],
    ['a note that is not text', { status: 'in_progress', note: 123 }],
    ['a note longer than 1000 characters', { status: 'in_progress', note: 'x'.repeat(1001) }],
    ['a note that is too long once trimmed', { status: 'closed', note: ` ${'x'.repeat(1001)} ` }],
  ])('returns 400 for %s and saves nothing', async (_label, body) => {
    const referral = fakeReferral();
    Referral.findOne.mockResolvedValue(referral);
    const res = mockRes();

    await updateReferralStatus(patchReq(body), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(referral.save).not.toHaveBeenCalled();
    expect(Referral.findOne).not.toHaveBeenCalled();
  });

  test('returns 400 for an invalid referral id', async () => {
    const res = mockRes();

    await updateReferralStatus(
      ngoReq({ params: { id: 'not-an-id' }, body: { status: 'resolved' } }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Referral.findOne).not.toHaveBeenCalled();
  });

  test("returns 404 for another NGO's referral and saves nothing", async () => {
    // findOne is scoped to { _id, ngo }, so a referral owned by a different NGO
    // simply is not found.
    Referral.findOne.mockResolvedValue(null);
    const res = mockRes();

    await updateReferralStatus(patchReq({ status: 'closed', note: 'not mine' }), res);

    expect(Referral.findOne).toHaveBeenCalledWith({ _id: referralId, ngo: ngoId });
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns 404 when the user has no NGO profile', async () => {
    Ngo.findOne.mockResolvedValue(null);
    const res = mockRes();

    await updateReferralStatus(patchReq({ status: 'resolved' }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(Referral.findOne).not.toHaveBeenCalled();
  });

  test('returns 403 for an account that is not approved', async () => {
    const res = mockRes();
    const req = patchReq(
      { status: 'resolved' },
      { user: { id: ngoUserId, role: 'ngo', status: 'pending' } }
    );

    await updateReferralStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Ngo.findOne).not.toHaveBeenCalled();
    expect(Referral.findOne).not.toHaveBeenCalled();
  });

  test('returns 500 when saving fails', async () => {
    const referral = fakeReferral({ save: jest.fn().mockRejectedValue(new Error('db down')) });
    Referral.findOne.mockResolvedValue(referral);
    const res = mockRes();

    await updateReferralStatus(patchReq({ status: 'resolved' }), res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ---------------------------------------------------------------------------
// Role guard: allowRoles('ngo') protects both NGO routes
// ---------------------------------------------------------------------------
describe('role guard: allowRoles("ngo")', () => {
  test('lets an NGO user through', () => {
    const next = jest.fn();
    const res = mockRes();

    allowRoles('ngo')({ user: { role: 'ngo' } }, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test.each(['volunteer', 'seeker', 'psychologist', 'facilitator', 'admin'])(
    'blocks a %s with 403',
    (role) => {
      const next = jest.fn();
      const res = mockRes();

      allowRoles('ngo')({ user: { role } }, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    }
  );

  test('blocks a request with no user with 403', () => {
    const next = jest.fn();
    const res = mockRes();

    allowRoles('ngo')({}, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Route wiring: both NGO routes really sit behind the NGO role guard
// ---------------------------------------------------------------------------
describe('NGO referral routes', () => {
  const router = require('../routes/referralRoutes');

  const handlersFor = (method, path) => {
    const layer = router.stack.find(
      (l) => l.route && l.route.path === path && l.route.methods[method]
    );
    return layer ? layer.route.stack.map((s) => s.handle) : [];
  };

  test.each([
    ['get', '/mine', 'getNgoReferrals'],
    ['get', '/:id', 'getNgoReferral'],
    ['patch', '/:id/status', 'updateReferralStatus'],
  ])('%s %s runs auth, then the NGO guard, then the controller', (method, path, name) => {
    const handlers = handlersFor(method, path);

    expect(handlers).toHaveLength(3);
    expect(handlers[2]).toBe(require('../controllers/referralController')[name]);
  });

  // Express matches routes in order. If "/:id" came first, GET /mine would be
  // handled as an id called "mine".
  test('GET /mine is registered before GET /:id', () => {
    const paths = router.stack
      .filter((l) => l.route && l.route.methods.get)
      .map((l) => l.route.path);

    expect(paths.indexOf('/mine')).toBeGreaterThanOrEqual(0);
    expect(paths.indexOf('/mine')).toBeLessThan(paths.indexOf('/:id'));
  });

  test.each([
    ['get', '/mine'],
    ['get', '/:id'],
    ['patch', '/:id/status'],
  ])('%s %s turns a volunteer away with 403 before the controller runs', (method, path) => {
    const guard = handlersFor(method, path)[1];
    const next = jest.fn();
    const res = mockRes();

    guard({ user: { role: 'volunteer' } }, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});