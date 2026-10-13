const bcrypt = require('bcryptjs');

// Unit tests for the facilitator seed (prerequisite for T12.11).

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

const EMAIL = 'facilitator@test.com';
const PASSWORD = 'Facilitator@12345';

let logSpy;
let exitSpy;

function runSeed() {
  return new Promise((resolve) => {
    mockStore.onDisconnect = resolve;
    jest.isolateModules(() => {
      require('../seeds/seedFacilitator.js');
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

describe('seedFacilitator script', () => {
  it('creates an approved facilitator with a hashed password', async () => {
    await runSeed();

    expect(exitSpy).not.toHaveBeenCalled();
    expect(mockStore.users).toHaveLength(1);

    const [user] = mockStore.users;
    expect(user.email).toBe(EMAIL);
    expect(user.role).toBe('facilitator');
    expect(user.status).toBe('approved');
    expect(user.password).not.toBe(PASSWORD);
    expect(await bcrypt.compare(PASSWORD, user.password)).toBe(true);
  });

  it('does not create a duplicate on a second run', async () => {
    await runSeed();

    expect(mockStore.users).toHaveLength(1);
  });

  // Someone may have registered the account by hand and left it pending.
  it('approves an existing facilitator that is still pending', async () => {
    mockStore.users[0].status = 'pending';

    await runSeed();

    expect(mockStore.users[0].status).toBe('approved');
    expect(mockStore.users[0].save).toHaveBeenCalled();
    expect(mockStore.users).toHaveLength(1);
  });

  it('prints the login for the tester', async () => {
    logSpy.mockClear();
    await runSeed();

    const printed = logSpy.mock.calls.flat().join('\n');
    expect(printed).toContain(EMAIL);
    expect(printed).toContain(PASSWORD);
  });
});
