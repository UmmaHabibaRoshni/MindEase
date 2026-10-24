// T16.2 (BL-16) - unit tests for the suspended status, the login block and the
// auth middleware check added in T16.1.
//
// User is mocked for the login and middleware tests, as everywhere else in this
// suite. The model tests use the real schema via jest.requireActual, because the
// enum and the defaults are the thing being tested.

jest.mock('../models/User', () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
}));
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'signed-token'),
  verify: jest.fn(),
}));

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const RealUser = jest.requireActual('../models/User');
const auth = require('../middleware/auth');
const { login } = require('../controllers/authController');

const userId = '507f1f77bcf86cd799439012';

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.resetAllMocks();
  jwt.sign.mockReturnValue('signed-token');
  process.env.JWT_SECRET = 'test-secret';
});

// ------------------------------------------------------------------ model

describe('User model: suspended status', () => {
  const base = { name: 'Test User', email: 'test@example.com', password: 'hashed', role: 'volunteer' };

  test('"suspended" is an allowed status', () => {
    const user = new RealUser({ ...base, status: 'suspended' });
    expect(user.validateSync()).toBeUndefined();
  });

  test('the old statuses are still allowed', () => {
    for (const status of ['pending', 'approved', 'rejected']) {
      expect(new RealUser({ ...base, status }).validateSync()).toBeUndefined();
    }
  });

  test('an unknown status is still rejected', () => {
    const error = new RealUser({ ...base, status: 'banned' }).validateSync();
    expect(error.errors.status).toBeDefined();
  });

  test('a new account is not suspended by default', () => {
    expect(new RealUser({ ...base }).status).not.toBe('suspended');
    expect(new RealUser({ ...base, role: 'seeker' }).status).toBe('approved');
  });

  test('the suspension fields are empty by default', () => {
    const user = new RealUser({ ...base });
    expect(user.suspendedBy).toBeNull();
    expect(user.suspendedAt).toBeNull();
    expect(user.suspensionReason).toBe('');
  });
});

// ------------------------------------------------------------------ login

describe('login: suspended accounts are refused', () => {
  const req = () => ({ body: { email: 'v@example.com', password: 'Secret@123' } });

  function givenAccount(status) {
    User.findOne.mockResolvedValue({
      _id: userId,
      name: 'V',
      email: 'v@example.com',
      password: 'hashed',
      role: 'volunteer',
      status,
    });
  }

  test('answers 403 with a suspended message and no token', async () => {
    givenAccount('suspended');
    bcrypt.compare.mockResolvedValue(true);
    const res = mockRes();

    await login(req(), res);

    expect(res.status).toHaveBeenCalledWith(403);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toMatch(/suspended/i);
    expect(body.token).toBeUndefined();
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  // The status is only revealed after the password is right, so someone
  // guessing passwords learns nothing about the account.
  test('a wrong password still answers 401, not 403', async () => {
    givenAccount('suspended');
    bcrypt.compare.mockResolvedValue(false);
    const res = mockRes();

    await login(req(), res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('an approved account still logs in', async () => {
    givenAccount('approved');
    bcrypt.compare.mockResolvedValue(true);
    const res = mockRes();

    await login(req(), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].token).toBe('signed-token');
  });

  test('pending and rejected accounts are still refused with their own messages', async () => {
    bcrypt.compare.mockResolvedValue(true);

    givenAccount('pending');
    const pendingRes = mockRes();
    await login(req(), pendingRes);
    expect(pendingRes.status).toHaveBeenCalledWith(403);
    expect(pendingRes.json.mock.calls[0][0].message).toMatch(/awaiting/i);

    givenAccount('rejected');
    const rejectedRes = mockRes();
    await login(req(), rejectedRes);
    expect(rejectedRes.status).toHaveBeenCalledWith(403);
    expect(rejectedRes.json.mock.calls[0][0].message).toMatch(/not approved/i);
  });
});

// ------------------------------------------------------- auth middleware

describe('auth middleware: checks the account status', () => {
  const withToken = () => ({ headers: { authorization: 'Bearer abc.def.ghi' } });

  // User.findById(...).select(...) resolves to the account
  function givenAccount(account) {
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(account) });
  }

  function givenValidToken(payload = { id: userId, role: 'volunteer', status: 'approved' }) {
    jwt.verify.mockReturnValue(payload);
  }

  test('lets an approved user through and attaches the current role and status', async () => {
    givenValidToken({ id: userId, role: 'seeker', status: 'pending' }); // stale token claims
    givenAccount({ role: 'volunteer', status: 'approved' });
    const req = withToken();
    const res = mockRes();
    const next = jest.fn();

    await auth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    // the database wins over what the token says
    expect(req.user).toEqual({ id: userId, role: 'volunteer', status: 'approved' });
  });

  test('answers 403 ACCOUNT_SUSPENDED when the account is suspended', async () => {
    givenValidToken();
    givenAccount({ role: 'volunteer', status: 'suspended' });
    const res = mockRes();
    const next = jest.fn();

    await auth(withToken(), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    const body = res.json.mock.calls[0][0];
    expect(body.code).toBe('ACCOUNT_SUSPENDED');
    expect(body.message).toMatch(/suspended/i);
    expect(next).not.toHaveBeenCalled();
  });

  // The token was signed while the account was approved. It is still
  // unexpired and still verifies - only the database lookup stops it.
  test('a token that is still valid stops working once the user is suspended', async () => {
    givenValidToken({ id: userId, role: 'volunteer', status: 'approved' });
    givenAccount({ role: 'volunteer', status: 'suspended' });
    const next = jest.fn();

    await auth(withToken(), mockRes(), next);

    expect(jwt.verify).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('works again after the user is reactivated', async () => {
    givenValidToken();
    givenAccount({ role: 'volunteer', status: 'approved' });
    const next = jest.fn();

    await auth(withToken(), mockRes(), next);

    expect(next).toHaveBeenCalled();
  });

  test('answers 401 when the account no longer exists', async () => {
    givenValidToken();
    givenAccount(null);
    const res = mockRes();
    const next = jest.fn();

    await auth(withToken(), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('answers 401 when there is no token', async () => {
    const res = mockRes();
    const next = jest.fn();

    await auth({ headers: {} }, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(User.findById).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('answers 401 for a bad or expired token, without touching the database', async () => {
    jwt.verify.mockImplementation(() => {
      throw new Error('jwt expired');
    });
    const res = mockRes();
    const next = jest.fn();

    await auth(withToken(), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(User.findById).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('answers 401 when the token carries a malformed user id', async () => {
    givenValidToken({ id: 'not-an-id', role: 'volunteer' });
    const res = mockRes();
    const next = jest.fn();

    await auth(withToken(), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(User.findById).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('answers 500, not a crash, when the database fails', async () => {
    givenValidToken();
    User.findById.mockReturnValue({ select: jest.fn().mockRejectedValue(new Error('db down')) });
    const res = mockRes();
    const next = jest.fn();

    await auth(withToken(), res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});
