
jest.mock('../models/User', () => ({
  find: jest.fn(),
  findById: jest.fn(),
}));

const User = require('../models/User');
const allowRoles = require('../middleware/role');
const {
  getPendingUsers,
  approveUser,
  rejectUser,
} = require('../controllers/adminController');

const adminId = '507f1f77bcf86cd799439011';
const userId = '507f1f77bcf86cd799439012';

beforeEach(() => {
  jest.resetAllMocks();
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
    status: 'pending',
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

describe('getPendingUsers', () => {
  test('asks for pending accounts only and hides the password', async () => {
    const users = [fakeUser()];
    const select = jest.fn().mockReturnValue({
      sort: jest.fn().mockResolvedValue(users),
    });
    User.find.mockReturnValue({ select });
    const res = mockRes();

    await getPendingUsers({}, res);

    expect(User.find).toHaveBeenCalledWith({ status: 'pending' });
    expect(select).toHaveBeenCalledWith('-password');
    expect(res.json).toHaveBeenCalledWith({ users });
  });

  test('returns 500 when the database fails', async () => {
    User.find.mockImplementation(() => {
      throw new Error('db down');
    });
    const res = mockRes();

    await getPendingUsers({}, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('approveUser', () => {
  test('approves a pending account and records who approved it', async () => {
    const user = fakeUser();
    User.findById.mockResolvedValue(user);
    const req = { params: { id: userId }, user: { id: adminId } };
    const res = mockRes();

    await approveUser(req, res);

    expect(user.status).toBe('approved');
    expect(user.verifiedBy).toBe(adminId);
    expect(user.verifiedAt).toBeInstanceOf(Date);
    expect(user.save).toHaveBeenCalled();

    const body = res.json.mock.calls[0][0];
    expect(body.message).toBe('Account approved.');
    expect(body.user.password).toBeUndefined();
  });

  test('refuses an account that is already reviewed', async () => {
    const user = fakeUser({ status: 'approved' });
    User.findById.mockResolvedValue(user);
    const req = { params: { id: userId }, user: { id: adminId } };
    const res = mockRes();

    await approveUser(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(user.save).not.toHaveBeenCalled();
  });

  test('returns 400 for an invalid id', async () => {
    const req = { params: { id: 'not-an-id' }, user: { id: adminId } };
    const res = mockRes();

    await approveUser(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(User.findById).not.toHaveBeenCalled();
  });

  test('returns 404 when the user does not exist', async () => {
    User.findById.mockResolvedValue(null);
    const req = { params: { id: userId }, user: { id: adminId } };
    const res = mockRes();

    await approveUser(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns 500 when the database fails', async () => {
    User.findById.mockRejectedValue(new Error('db down'));
    const req = { params: { id: userId }, user: { id: adminId } };
    const res = mockRes();

    await approveUser(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('rejectUser', () => {
  test('requires a reason', async () => {
    const req = {
      params: { id: userId },
      body: { reason: '   ' },
      user: { id: adminId },
    };
    const res = mockRes();

    await rejectUser(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(User.findById).not.toHaveBeenCalled();
  });

  test('rejects a pending account and saves the reason', async () => {
    const user = fakeUser();
    User.findById.mockResolvedValue(user);
    const req = {
      params: { id: userId },
      body: { reason: 'Documents could not be verified' },
      user: { id: adminId },
    };
    const res = mockRes();

    await rejectUser(req, res);

    expect(user.status).toBe('rejected');
    expect(user.rejectionReason).toBe('Documents could not be verified');
    expect(user.verifiedBy).toBe(adminId);
    expect(user.save).toHaveBeenCalled();

    const body = res.json.mock.calls[0][0];
    expect(body.message).toBe('Account rejected.');
    expect(body.user.password).toBeUndefined();
  });

  test('refuses an account that is already reviewed', async () => {
    const user = fakeUser({ status: 'rejected' });
    User.findById.mockResolvedValue(user);
    const req = {
      params: { id: userId },
      body: { reason: 'Again' },
      user: { id: adminId },
    };
    const res = mockRes();

    await rejectUser(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(user.save).not.toHaveBeenCalled();
  });
});

describe('role guard: allowRoles("admin")', () => {
  test('lets an admin through', () => {
    const next = jest.fn();
    allowRoles('admin')({ user: { role: 'admin' } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('blocks a volunteer with 403', () => {
    const next = jest.fn();
    const res = mockRes();
    allowRoles('admin')({ user: { role: 'volunteer' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('blocks a request with no user with 403', () => {
    const next = jest.fn();
    const res = mockRes();
    allowRoles('admin')({}, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});