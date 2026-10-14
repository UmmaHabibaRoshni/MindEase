const bcrypt = require('bcryptjs');

jest.setTimeout(30000);

// T13.3 - unit tests for the test psychologist seed (T13.2).
// User is mocked over a small in-memory store, in the same style as
// seedFacilitator.test.js, so the script runs without a database.

const mockStore = { users: [], onDisconnect: null };

const mockNewId = () => new (require('mongoose').Types.ObjectId)();

jest.mock('../models/User', () => ({
  findOne: jest.fn(async (query) => {
    if (query.email) {
      return (
        mockStore.users.find((u) => u.email.toLowerCase() === query.email.toLowerCase()) || null
      );
    }
    return mockStore.users.find((u) => u.role === query.role) || null;
  }),
  create: jest.fn(async (data) => {
    const user = { _id: mockNewId(), ...data };
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

const EMAIL = 'psychologist@mindease.test';
const PASSWORD = 'Psychologist@123';

let logSpy;
let exitSpy;

function runSeed() {
  return new Promise((resolve) => {
    mockStore.onDisconnect = resolve;
    jest.isolateModules(() => {
      require('../seeds/seedPsychologist.js');
    });
  });
}

beforeAll(() => {
  process.env.MONGO_URI = 'mongodb://mock/test';
  process.env.PSYCHOLOGIST_EMAIL = EMAIL;
  process.env.PSYCHOLOGIST_PASSWORD = PASSWORD;
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

describe('seedPsychologist script (T13.2)', () => {
  it('creates an approved psychologist with a hashed password', async () => {
    await runSeed();

    expect(exitSpy).not.toHaveBeenCalled();
    expect(mockStore.users).toHaveLength(1);

    const [user] = mockStore.users;
    expect(user.email).toBe(EMAIL);
    expect(user.role).toBe('psychologist');
    expect(user.status).toBe('approved');
    expect(user.password).not.toBe(PASSWORD);
    expect(await bcrypt.compare(PASSWORD, user.password)).toBe(true);
  });

  it('stamps the approval time, with no approver when there is no admin', () => {
    const [user] = mockStore.users;

    expect(user.verifiedAt).toBeInstanceOf(Date);
    expect(user.verifiedBy).toBeNull();
  });

  it('does not create a duplicate on a second run', async () => {
    await runSeed();

    expect(exitSpy).not.toHaveBeenCalled();
    expect(mockStore.users).toHaveLength(1);
  });

  it('says so when the psychologist already exists', async () => {
    logSpy.mockClear();
    await runSeed();

    const printed = logSpy.mock.calls.flat().join('\n');
    expect(printed).toContain('already exists');
    expect(printed).toContain(EMAIL);
  });

  it('records the admin as the approver when an admin exists', async () => {
    const admin = {
      _id: mockNewId(),
      email: 'admin@test.com',
      role: 'admin',
      status: 'approved',
    };
    mockStore.users.length = 0;
    mockStore.users.push(admin);

    await runSeed();

    const psychologist = mockStore.users.find((u) => u.role === 'psychologist');
    expect(psychologist).toBeDefined();
    expect(String(psychologist.verifiedBy)).toBe(String(admin._id));
    expect(mockStore.users).toHaveLength(2);
  });

  it('prints the email of the account it created', async () => {
    mockStore.users.length = 0;
    logSpy.mockClear();

    await runSeed();

    const printed = logSpy.mock.calls.flat().join('\n');
    expect(printed).toContain('Psychologist created');
    expect(printed).toContain(EMAIL);
  });
});