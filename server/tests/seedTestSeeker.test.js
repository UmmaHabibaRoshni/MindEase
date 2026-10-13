const bcrypt = require('bcryptjs');

// Unit tests for the test seeker seed (needed by the BL-12 Selenium specs).

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

const EMAIL = 'seeker@test.com';
const PASSWORD = 'Seeker@12345';

let logSpy;
let exitSpy;

function runSeed() {
  return new Promise((resolve) => {
    mockStore.onDisconnect = resolve;
    jest.isolateModules(() => {
      require('../seeds/seedTestSeeker.js');
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

describe('seedTestSeeker script', () => {
  it('creates an approved seeker with a hashed password', async () => {
    await runSeed();

    expect(exitSpy).not.toHaveBeenCalled();
    expect(mockStore.users).toHaveLength(1);

    const [user] = mockStore.users;
    expect(user.email).toBe(EMAIL);
    expect(user.role).toBe('seeker');
    expect(user.status).toBe('approved');
    expect(user.password).not.toBe(PASSWORD);
    expect(await bcrypt.compare(PASSWORD, user.password)).toBe(true);
  });

  // The point of this seed: seedTestNgo only creates a seeker when the
  // database has none, so on a populated database nobody knew a password.
  it('creates the account even when other seekers already exist', async () => {
    mockStore.users.push({ _id: mockNewId(), email: 'someone.else@test.com', role: 'seeker', status: 'approved' });

    await runSeed();

    expect(mockStore.users.filter((u) => u.email === EMAIL)).toHaveLength(1);
  });

  it('does not create a duplicate on a second run', async () => {
    const before = mockStore.users.filter((u) => u.email === EMAIL).length;

    await runSeed();

    expect(mockStore.users.filter((u) => u.email === EMAIL)).toHaveLength(before);
  });

  it('repairs the account if its role or status drifted', async () => {
    const user = mockStore.users.find((u) => u.email === EMAIL);
    user.status = 'pending';
    user.role = 'volunteer';

    await runSeed();

    expect(user.status).toBe('approved');
    expect(user.role).toBe('seeker');
    expect(user.save).toHaveBeenCalled();
  });

  it('prints the login for the tester', async () => {
    logSpy.mockClear();
    await runSeed();

    const printed = logSpy.mock.calls.flat().join('\n');
    expect(printed).toContain(EMAIL);
    expect(printed).toContain(PASSWORD);
  });
});
