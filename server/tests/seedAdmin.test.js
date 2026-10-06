const bcrypt = require('bcryptjs');

const mockDb = { users: [], onDisconnect: null };

jest.mock('../models/User', () => ({
  findOne: jest.fn(async (query) => {
    const email = query.$or[1].email;
    return (
      mockDb.users.find((u) => u.role === 'admin' || u.email.toLowerCase() === email) ||
      null
    );
  }),
  create: jest.fn(async (data) => {
    const user = { ...data };
    mockDb.users.push(user);
    return user;
  }),
}));

jest.mock('mongoose', () => ({
  connect: jest.fn(async () => {}),
  disconnect: jest.fn(async () => {
    if (mockDb.onDisconnect) mockDb.onDisconnect();
  }),
}));

const ADMIN_EMAIL = 'Admin@Test.com';
const ADMIN_PASSWORD = 'StrongPass123';

let logSpy;
let exitSpy;

function runSeed() {
  return new Promise((resolve) => {
    mockDb.onDisconnect = resolve;
    jest.isolateModules(() => {
      require('../seeds/seedAdmin.js');
    });
  });
}

beforeAll(() => {
  process.env.ADMIN_EMAIL = ADMIN_EMAIL;
  process.env.ADMIN_PASSWORD = ADMIN_PASSWORD;
  process.env.MONGO_URI = 'mongodb://mock/test';
  exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
});

beforeEach(() => {
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
});

afterAll(() => {
  exitSpy.mockRestore();
});

describe('seedAdmin script', () => {
  test('first run creates one approved admin with hashed password', async () => {
    await runSeed();

    expect(exitSpy).not.toHaveBeenCalled();
    const admins = mockDb.users.filter((u) => u.role === 'admin');
    expect(admins).toHaveLength(1);
    expect(admins[0].email).toBe(ADMIN_EMAIL);
    expect(admins[0].status).toBe('approved');
    expect(admins[0].password).not.toBe(ADMIN_PASSWORD);
    expect(await bcrypt.compare(ADMIN_PASSWORD, admins[0].password)).toBe(true);
  });

  test('second run does not create a duplicate admin', async () => {
    await runSeed();

    expect(exitSpy).not.toHaveBeenCalled();
    expect(mockDb.users.filter((u) => u.role === 'admin')).toHaveLength(1);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Admin already exists')
    );
  });
});