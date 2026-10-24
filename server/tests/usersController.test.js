// T16.6 (BL-16) - unit tests for the admin users controller (list, suspend,
// reactivate) and the admin guard in front of it.
// The models are mocked, so no database runs.

jest.mock('../models/User', () => ({
  find: jest.fn(),
  findById: jest.fn(),
}));
jest.mock('../utils/notify', () => ({
  notify: jest.fn(async () => null),
}));

const User = require('../models/User');
const { notify } = require('../utils/notify');
const allowRoles = require('../middleware/role');
const { listUsers, suspendUser, reactivateUser } = require('../controllers/adminController');

const adminId = '507f1f77bcf86cd799439011';
const userId = '507f1f77bcf86cd799439012';

beforeEach(() => {
  jest.resetAllMocks();
  notify.mockResolvedValue(null);
});

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function fakeUser(overrides = {}) {
  const u = {
    _id: userId,
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashedpassword',
    role: 'volunteer',
    status: 'approved',
    suspendedBy: null,
    suspendedAt: null,
    suspensionReason: '',
    ...overrides,
    save: jest.fn().mockResolvedValue(),
  };
  u.toObject = () => {
    const copy = { ...u };
    delete copy.save;
    delete copy.toObject;
    return copy;
  };
  return u;
}

// User.find(...).select(...).sort(...).limit(...) resolves to the list
function givenList(users) {
  const limit = jest.fn().mockResolvedValue(users);
  const sort = jest.fn().mockReturnValue({ limit });
  const select = jest.fn().mockReturnValue({ sort });
  User.find.mockReturnValue({ select });
  return { select, sort, limit };
}

const listReq = (query = {}) => ({ query, user: { id: adminId, role: 'admin' } });
const actReq = (extra = {}) => ({
  params: { id: userId },
  body: {},
  user: { id: adminId, role: 'admin' },
  ...extra,
});

// ------------------------------------------------------------------ list

describe('listUsers', () => {
  test('with no filters it asks for every user and hides the password', async () => {
    const users = [fakeUser()];
    const { select, sort } = givenList(users);
    const res = mockRes();

    await listUsers(listReq(), res);

    expect(User.find).toHaveBeenCalledWith({});
    expect(select).toHaveBeenCalledWith('-password');
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(res.json).toHaveBeenCalledWith({ users });
  });

  test('filters by role', async () => {
    givenList([]);
    await listUsers(listReq({ role: 'volunteer' }), mockRes());
    expect(User.find).toHaveBeenCalledWith({ role: 'volunteer' });
  });

  test('filters by status, including suspended', async () => {
    givenList([]);
    await listUsers(listReq({ status: 'suspended' }), mockRes());
    expect(User.find).toHaveBeenCalledWith({ status: 'suspended' });
  });

  test('filters by role and status together', async () => {
    givenList([]);
    await listUsers(listReq({ role: 'volunteer', status: 'approved' }), mockRes());
    expect(User.find).toHaveBeenCalledWith({ role: 'volunteer', status: 'approved' });
  });

  test('empty filter values are ignored', async () => {
    givenList([]);
    await listUsers(listReq({ role: '', status: '', q: '   ' }), mockRes());
    expect(User.find).toHaveBeenCalledWith({});
  });

  test('searches name and email, case-insensitively', async () => {
    givenList([]);
    await listUsers(listReq({ q: 'Ayesha' }), mockRes());

    const filter = User.find.mock.calls[0][0];
    expect(filter.$or).toHaveLength(2);
    expect(filter.$or[0].name.test('ayesha khan')).toBe(true);
    expect(filter.$or[1].email.test('AYESHA@example.com')).toBe(true);
  });

  // "a.b" must match the text "a.b", not "a" + any character + "b"
  test('treats the search text literally, not as a pattern', async () => {
    givenList([]);
    await listUsers(listReq({ q: 'a.b' }), mockRes());

    const pattern = User.find.mock.calls[0][0].$or[0].name;
    expect(pattern.test('a.b')).toBe(true);
    expect(pattern.test('axb')).toBe(false);
  });

  test('a search with regex characters does not crash', async () => {
    givenList([]);
    const res = mockRes();

    await listUsers(listReq({ q: '(((' }), res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
  });

  test('answers 400 for an unknown role and does not query', async () => {
    const res = mockRes();
    await listUsers(listReq({ role: 'wizard' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(User.find).not.toHaveBeenCalled();
  });

  test('answers 400 for an unknown status and does not query', async () => {
    const res = mockRes();
    await listUsers(listReq({ status: 'banned' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(User.find).not.toHaveBeenCalled();
  });

  // ?role=a&role=b arrives as an array; passing it on could become a query operator
  test('answers 400 when a filter is repeated (array) or an object', async () => {
    const res1 = mockRes();
    await listUsers(listReq({ role: ['seeker', 'admin'] }), res1);
    expect(res1.status).toHaveBeenCalledWith(400);

    const res2 = mockRes();
    await listUsers(listReq({ status: { $ne: 'approved' } }), res2);
    expect(res2.status).toHaveBeenCalledWith(400);

    expect(User.find).not.toHaveBeenCalled();
  });

  test('returns 500 when the database fails', async () => {
    User.find.mockImplementation(() => {
      throw new Error('db down');
    });
    const res = mockRes();

    await listUsers(listReq(), res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// --------------------------------------------------------------- suspend

describe('suspendUser', () => {
  test('suspends an approved account and records who, when and why', async () => {
    const user = fakeUser();
    User.findById.mockResolvedValue(user);
    const res = mockRes();

    await suspendUser(actReq({ body: { reason: '  Abusive messages  ' } }), res);

    expect(user.status).toBe('suspended');
    expect(user.suspendedBy).toBe(adminId);
    expect(user.suspendedAt).toBeInstanceOf(Date);
    expect(user.suspensionReason).toBe('Abusive messages');
    expect(user.save).toHaveBeenCalled();

    const body = res.json.mock.calls[0][0];
    expect(body.message).toBe('Account suspended.');
    expect(body.user.status).toBe('suspended');
    expect(body.user.password).toBeUndefined();
  });

  test('requires a reason', async () => {
    for (const reason of [undefined, '', '   ']) {
      const res = mockRes();
      await suspendUser(actReq({ body: { reason } }), res);
      expect(res.status).toHaveBeenCalledWith(400);
    }
    expect(User.findById).not.toHaveBeenCalled();
  });

  test('a reason that is not text is refused', async () => {
    const res = mockRes();
    await suspendUser(actReq({ body: { reason: { a: 1 } } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(User.findById).not.toHaveBeenCalled();
  });

  test('refuses a reason over 500 characters', async () => {
    const res = mockRes();
    await suspendUser(actReq({ body: { reason: 'x'.repeat(501) } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(User.findById).not.toHaveBeenCalled();
  });

  test('answers 400 for an invalid id', async () => {
    const res = mockRes();
    await suspendUser(actReq({ params: { id: 'not-an-id' }, body: { reason: 'x' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(User.findById).not.toHaveBeenCalled();
  });

  test('an admin cannot suspend their own account', async () => {
    const res = mockRes();
    await suspendUser(actReq({ params: { id: adminId }, body: { reason: 'x' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(/own account/i);
    expect(User.findById).not.toHaveBeenCalled();
  });

  test('answers 404 when the user does not exist', async () => {
    User.findById.mockResolvedValue(null);
    const res = mockRes();
    await suspendUser(actReq({ body: { reason: 'x' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('refuses an account that is already suspended', async () => {
    const user = fakeUser({ status: 'suspended' });
    User.findById.mockResolvedValue(user);
    const res = mockRes();

    await suspendUser(actReq({ body: { reason: 'x' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(/already suspended/i);
    expect(user.save).not.toHaveBeenCalled();
  });

  test.each(['pending', 'rejected'])('refuses a %s account (use verification instead)', async (status) => {
    const user = fakeUser({ status });
    User.findById.mockResolvedValue(user);
    const res = mockRes();

    await suspendUser(actReq({ body: { reason: 'x' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(user.status).toBe(status);
    expect(user.save).not.toHaveBeenCalled();
  });

  test('returns 500 when the database fails', async () => {
    User.findById.mockRejectedValue(new Error('db down'));
    const res = mockRes();
    await suspendUser(actReq({ body: { reason: 'x' } }), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ------------------------------------------------------------ reactivate

describe('reactivateUser', () => {
  const suspended = () =>
    fakeUser({
      status: 'suspended',
      suspendedBy: adminId,
      suspendedAt: new Date(),
      suspensionReason: 'Abusive messages',
    });

  test('puts a suspended account back to approved and clears the suspension fields', async () => {
    const user = suspended();
    User.findById.mockResolvedValue(user);
    const res = mockRes();

    await reactivateUser(actReq(), res);

    expect(user.status).toBe('approved');
    expect(user.suspendedBy).toBeNull();
    expect(user.suspendedAt).toBeNull();
    expect(user.suspensionReason).toBe('');
    expect(user.save).toHaveBeenCalled();

    const body = res.json.mock.calls[0][0];
    expect(body.message).toBe('Account reactivated.');
    expect(body.user.password).toBeUndefined();
  });

  test('tells the user they are back', async () => {
    User.findById.mockResolvedValue(suspended());

    await reactivateUser(actReq(), mockRes());

    expect(notify).toHaveBeenCalledWith(
      userId,
      'account_approved',
      expect.stringMatching(/reactivated/i),
      '/dashboard'
    );
  });

  test('refuses an account that is not suspended', async () => {
    const user = fakeUser({ status: 'approved' });
    User.findById.mockResolvedValue(user);
    const res = mockRes();

    await reactivateUser(actReq(), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(user.save).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  test('answers 400 for an invalid id', async () => {
    const res = mockRes();
    await reactivateUser(actReq({ params: { id: '123' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(User.findById).not.toHaveBeenCalled();
  });

  test('answers 404 when the user does not exist', async () => {
    User.findById.mockResolvedValue(null);
    const res = mockRes();
    await reactivateUser(actReq(), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns 500 when the database fails', async () => {
    User.findById.mockRejectedValue(new Error('db down'));
    const res = mockRes();
    await reactivateUser(actReq(), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ----------------------------------------------------------- admin guard

describe('admin guard in front of the users routes', () => {
  it('lets an admin through', () => {
    const next = jest.fn();
    allowRoles('admin')({ user: { role: 'admin' } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it.each(['seeker', 'volunteer', 'psychologist', 'ngo', 'facilitator'])(
    'answers 403 for a %s',
    (role) => {
      const next = jest.fn();
      const res = mockRes();
      allowRoles('admin')({ user: { role } }, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    }
  );

  it('answers 403 when there is no user on the request at all', () => {
    const next = jest.fn();
    const res = mockRes();
    allowRoles('admin')({}, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('the users routes are registered on the admin router', () => {
  it('mounts list, suspend and reactivate', () => {
    jest.isolateModules(() => {
      const router = require('../routes/adminRoutes');
      const paths = router.stack
        .filter((layer) => layer.route)
        .map((layer) => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);

      expect(paths).toContain('GET /users');
      expect(paths).toContain('PATCH /users/:id/suspend');
      expect(paths).toContain('PATCH /users/:id/reactivate');
    });
  });
});
