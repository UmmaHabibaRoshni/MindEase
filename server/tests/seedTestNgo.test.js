const bcrypt = require('bcryptjs');

// T14.3 - unit tests for the test NGO seed (T14.2).
// The models are mocked over a small in-memory store, in the same style as
// seedAdmin.test.js, so the script runs without a database.

const mockStore = { users: [], ngos: [], referrals: [], requests: [], onDisconnect: null };

const mockNewId = () => new (require('mongoose').Types.ObjectId)();

jest.mock('../models/User', () => ({
  findOne: jest.fn(async (query) => {
    if (query.email) {
      return mockStore.users.find((u) => u.email.toLowerCase() === query.email.toLowerCase()) || null;
    }
    return (
      mockStore.users.find(
        (u) => u.role === query.role && (!query.status || u.status === query.status)
      ) || null
    );
  }),
  create: jest.fn(async (data) => {
    const user = { _id: mockNewId(), ...data };
    mockStore.users.push(user);
    return user;
  }),
}));

jest.mock('../models/Ngo', () => ({
  findOneAndUpdate: jest.fn(async (query, update) => {
    const existing = mockStore.ngos.find(
      (n) => n.registrationNumber === query.registrationNumber
    );
    if (existing) {
      Object.assign(existing, update);
      return existing;
    }
    const ngo = { _id: mockNewId(), ...query, ...update };
    mockStore.ngos.push(ngo);
    return ngo;
  }),
}));

jest.mock('../models/Referral', () => ({
  findOne: jest.fn(async (query) =>
    mockStore.referrals.find((r) => String(r.ngo) === String(query.ngo)) || null
  ),
  create: jest.fn(async (data) => {
    const referral = { _id: mockNewId(), status: 'pending', ...data };
    mockStore.referrals.push(referral);
    return referral;
  }),
}));

jest.mock('../models/CrisisRequest', () => ({
  create: jest.fn(async (data) => {
    const req = { _id: mockNewId(), ...data };
    mockStore.requests.push(req);
    return req;
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

const TEST_EMAIL = 'ngo@test.com';
const TEST_PASSWORD = 'Ngo@12345';

let logSpy;
let exitSpy;

function runSeed() {
  return new Promise((resolve) => {
    mockStore.onDisconnect = resolve;
    jest.isolateModules(() => {
      require('../seeds/seedTestNgo.js');
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

describe('seedTestNgo script (T14.2)', () => {
  it('creates an approved NGO user with a hashed password', async () => {
    await runSeed();

    expect(exitSpy).not.toHaveBeenCalled();

    const ngoUsers = mockStore.users.filter((u) => u.role === 'ngo');
    expect(ngoUsers).toHaveLength(1);
    expect(ngoUsers[0].email).toBe(TEST_EMAIL);
    expect(ngoUsers[0].status).toBe('approved');
    expect(ngoUsers[0].password).not.toBe(TEST_PASSWORD);
    expect(await bcrypt.compare(TEST_PASSWORD, ngoUsers[0].password)).toBe(true);
  });

  it('links an NGO profile to that user', async () => {
    expect(mockStore.ngos).toHaveLength(1);

    const [profile] = mockStore.ngos;
    const [user] = mockStore.users.filter((u) => u.role === 'ngo');

    expect(String(profile.user)).toBe(String(user._id));
    expect(profile.registrationNumber).toBe('TEST-REG-001');
    expect(profile.organizationName).toBe('Test NGO Organisation');
    expect(profile.categories).toContain('mental_health');
  });

  // It must not clash with the three NGOs that seedNgos.js already creates.
  it('uses its own registration number, not one from seedNgos', () => {
    const seedNgosNumbers = ['DEMO-REG-001', 'DEMO-REG-002', 'DEMO-REG-003'];

    expect(seedNgosNumbers).not.toContain(mockStore.ngos[0].registrationNumber);
  });

  it('creates a referral so the dashboard is not empty', () => {
    expect(mockStore.referrals).toHaveLength(1);

    const [referral] = mockStore.referrals;
    expect(String(referral.ngo)).toBe(String(mockStore.ngos[0]._id));
    expect(referral.consentGiven).toBe(true);
    expect(referral.consentAt).toBeInstanceOf(Date);
    expect(referral.status).toBe('pending');
  });

  it('creates the crisis request the referral points at', () => {
    expect(mockStore.requests).toHaveLength(1);

    const [request] = mockStore.requests;
    expect(String(mockStore.referrals[0].request)).toBe(String(request._id));
    expect(request.status).toBe('referred');
  });

  it('is safe to run a second time', async () => {
    await runSeed();

    expect(exitSpy).not.toHaveBeenCalled();
    expect(mockStore.users.filter((u) => u.role === 'ngo')).toHaveLength(1);
    expect(mockStore.ngos).toHaveLength(1);
    expect(mockStore.referrals).toHaveLength(1);
    expect(mockStore.requests).toHaveLength(1);
  });

  it('prints the login so a tester can use it', async () => {
    logSpy.mockClear();
    await runSeed();

    const printed = logSpy.mock.calls.flat().join('\n');
    expect(printed).toContain(TEST_EMAIL);
    expect(printed).toContain(TEST_PASSWORD);
  });
});
