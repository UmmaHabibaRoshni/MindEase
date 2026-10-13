const bcrypt = require('bcryptjs');

// Unit tests for the test admin seed (needed by Selenium specs T8.E1, T11.E3).

const mockStore = { users: [], onDisconnect: null };

const mockNewId = () => new (require('mongoose').Types.ObjectId)();

jest.mock('../models/User', () => ({
  findOne: jest.fn(async (query) =>
    mockStore.users.find((u) => u.email.toLowerCase() === query.email.toLowerCase()) || null
  ),
  create: jest.fn(async (data) => {
    const user = { _id: mockNewId(), ...data, save: jest.fn(async () => user) };
    mockStore.users.push(user);
    return user;
  }),
}));

jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return {
    Types: actual.Types,
    connect: jest.fn(async () => {}),
    disconnect: jest.fn(async () => {
      if (mockStore.onDisconnect) mockStore.onDisconnect();
    }),
  };
});

const EMAIL = 'admin.test@mindease.com';
const PASSWORD = 'Admin@12345';

let logSpy;
let exitSpy;

function runSeed() {
  return new Promise((resolve) => {
    mockStore.onDisconnect = resolve;
    jest.isolateModules(() => {
      require('../seeds/seedTestAdmin.js');
    });
  });
}

beforeAll(() => {
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

describe('seedTestAdmin script', () => {
  it('creates an approved admin with a hashed password', async () => {
    await runSeed();

    expect(exitSpy).not.toHaveBeenCalled();
    expect(mockStore.users).toHaveLength(1);

    const [user] = mockStore.users;
    expect(user.email).toBe(EMAIL);
    expect(user.role).toBe('admin');
    expect(user.status).toBe('approved');
    expect(await bcrypt.compare(PASSWORD, user.password)).toBe(true);
  });

  // The original admin@mindease.com password is unknown and bcrypt-hashed, so
  // this seed must add a separate account rather than reset that one.
  it('uses its own email, not the shared admin account', () => {
    expect(mockStore.users[0].email).not.toBe('admin@mindease.com');
  });

  it('does not create a duplicate on a second run', async () => {
    await runSeed();

    expect(mockStore.users).toHaveLength(1);
  });

  it('repairs the account if its role or status drifted', async () => {
    mockStore.users[0].status = 'pending';
    mockStore.users[0].role = 'seeker';

    await runSeed();

    expect(mockStore.users[0].status).toBe('approved');
    expect(mockStore.users[0].role).toBe('admin');
    expect(mockStore.users[0].save).toHaveBeenCalled();
  });

  it('prints the login for the tester', async () => {
    logSpy.mockClear();
    await runSeed();

    const printed = logSpy.mock.calls.flat().join('\n');
    expect(printed).toContain(EMAIL);
    expect(printed).toContain(PASSWORD);
  });
});
