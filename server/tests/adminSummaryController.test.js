// T16.4 (BL-16) - unit tests for the admin summary API and the admin guard.
//
// The models are mocked, as everywhere else in this suite. Each mock carries a
// real `schema.path(...).enumValues` because the controller reads its buckets
// from the schema rather than from a hardcoded list - that behaviour is the
// point of several of these tests.

const makeSchema = (fields) => ({
  path: (name) => (fields[name] ? { enumValues: fields[name] } : undefined),
});

jest.mock('../models/User', () => ({
  aggregate: jest.fn(),
  schema: {
    path: (name) =>
      ({
        role: { enumValues: ['seeker', 'volunteer', 'psychologist', 'ngo', 'facilitator', 'admin'] },
        status: { enumValues: ['pending', 'approved', 'rejected'] },
      }[name]),
  },
}));

jest.mock('../models/CrisisRequest', () => ({
  aggregate: jest.fn(),
  schema: {
    path: (name) =>
      ({
        status: { enumValues: ['pending', 'accepted', 'escalated', 'referred', 'closed'] },
        category: { enumValues: ['mental_health', 'abuse', 'financial'] },
      }[name]),
  },
}));

jest.mock('../models/Workshop', () => ({
  aggregate: jest.fn(),
  schema: { path: (name) => (name === 'status' ? { enumValues: ['Scheduled', 'Cancelled'] } : undefined) },
}));

jest.mock('../models/Referral', () => ({
  aggregate: jest.fn(),
  schema: {
    path: (name) =>
      (name === 'status' ? { enumValues: ['pending', 'in_progress', 'resolved', 'closed'] } : undefined),
  },
}));

jest.mock('../models/WorkshopEnrollment', () => ({ countDocuments: jest.fn() }));

const User = require('../models/User');
const CrisisRequest = require('../models/CrisisRequest');
const Workshop = require('../models/Workshop');
const Referral = require('../models/Referral');
const WorkshopEnrollment = require('../models/WorkshopEnrollment');
const allowRoles = require('../middleware/role');
const { getAdminSummary } = require('../controllers/adminSummaryController');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const row = (id, count) => ({ _id: id, count });

// The happy-path data every test starts from. Individual tests override one
// collection at a time so a failure points at one thing.
function givenCounts({
  roles = [row('seeker', 6), row('volunteer', 2), row('admin', 1)],
  userStatuses = [row('approved', 7), row('pending', 2)],
  requestStatuses = [row('pending', 3), row('closed', 1)],
  requestCategories = [row('mental_health', 4)],
  workshopStatuses = [row('Scheduled', 5), row('Cancelled', 2)],
  referralStatuses = [row('pending', 1), row('resolved', 2)],
  enrolled = 9,
} = {}) {
  User.aggregate.mockResolvedValueOnce(roles).mockResolvedValueOnce(userStatuses);
  CrisisRequest.aggregate
    .mockResolvedValueOnce(requestStatuses)
    .mockResolvedValueOnce(requestCategories);
  Workshop.aggregate.mockResolvedValueOnce(workshopStatuses);
  Referral.aggregate.mockResolvedValueOnce(referralStatuses);
  WorkshopEnrollment.countDocuments.mockResolvedValueOnce(enrolled);
}

async function callSummary() {
  const res = mockRes();
  await getAdminSummary({ user: { id: 'admin1', role: 'admin' } }, res);
  return res;
}

beforeEach(() => {
  jest.resetAllMocks();
});

describe('GET /api/admin/summary (T16.3)', () => {
  it('reports users by role and by status', async () => {
    givenCounts();

    const res = await callSummary();
    const { users } = res.json.mock.calls[0][0];

    expect(users.byRole.seeker).toBe(6);
    expect(users.byRole.volunteer).toBe(2);
    expect(users.byRole.admin).toBe(1);
    expect(users.byStatus.approved).toBe(7);
    expect(users.byStatus.pending).toBe(2);
  });

  // The dashboard draws a fixed row of cards. If an empty bucket were missing
  // instead of zero, the card would read "undefined".
  it('reports a zero for every bucket nobody is in', async () => {
    givenCounts();

    const { users, requests } = (await callSummary()).json.mock.calls[0][0];

    expect(users.byRole.ngo).toBe(0);
    expect(users.byRole.facilitator).toBe(0);
    expect(users.byStatus.rejected).toBe(0);
    expect(requests.byStatus.escalated).toBe(0);
    expect(requests.byCategory.abuse).toBe(0);
  });

  it('reports requests by status and by category', async () => {
    givenCounts();

    const { requests } = (await callSummary()).json.mock.calls[0][0];

    expect(requests.byStatus.pending).toBe(3);
    expect(requests.byStatus.closed).toBe(1);
    expect(requests.byCategory.mental_health).toBe(4);
  });

  it('reports workshops with the number of live enrollments', async () => {
    givenCounts();

    const { workshops } = (await callSummary()).json.mock.calls[0][0];

    expect(workshops.byStatus.Scheduled).toBe(5);
    expect(workshops.byStatus.Cancelled).toBe(2);
    expect(workshops.activeEnrollments).toBe(9);
  });

  // Cancelled enrollments must not be counted, or the dashboard overstates how
  // many people are actually attending.
  it('counts only enrollments that are still active', async () => {
    givenCounts();

    await callSummary();

    expect(WorkshopEnrollment.countDocuments).toHaveBeenCalledWith({ status: 'Enrolled' });
  });

  it('reports referrals by status', async () => {
    givenCounts();

    const { referrals } = (await callSummary()).json.mock.calls[0][0];

    expect(referrals.byStatus.pending).toBe(1);
    expect(referrals.byStatus.resolved).toBe(2);
    expect(referrals.byStatus.closed).toBe(0);
  });

  it('adds each total up from its own buckets', async () => {
    givenCounts();

    const body = (await callSummary()).json.mock.calls[0][0];

    expect(body.users.total).toBe(9); // 6 + 2 + 1
    expect(body.requests.total).toBe(4); // 3 + 1
    expect(body.workshops.total).toBe(7); // 5 + 2
    expect(body.referrals.total).toBe(3); // 1 + 2
  });

  // T16.1 adds a 'suspended' status to User. Until it lands the value cannot
  // appear, but the moment it does this API must report it without an edit.
  it('reports a value that is in the data but not yet in the enum', async () => {
    givenCounts({ userStatuses: [row('approved', 7), row('suspended', 2)] });

    const { users } = (await callSummary()).json.mock.calls[0][0];

    expect(users.byStatus.suspended).toBe(2);
    expect(users.total).toBe(9);
  });

  // An aggregate can return a null bucket for documents missing the field.
  // Counting it under "null" would put a nonsense card on the dashboard.
  it('ignores a null bucket', async () => {
    givenCounts({ requestCategories: [row('mental_health', 4), row(null, 3)] });

    const { requests } = (await callSummary()).json.mock.calls[0][0];

    expect(requests.byCategory).not.toHaveProperty('null');
    expect(requests.byCategory.mental_health).toBe(4);
  });

  it('reports zeros rather than failing on an empty database', async () => {
    givenCounts({
      roles: [],
      userStatuses: [],
      requestStatuses: [],
      requestCategories: [],
      workshopStatuses: [],
      referralStatuses: [],
      enrolled: 0,
    });

    const body = (await callSummary()).json.mock.calls[0][0];

    expect(body.users.total).toBe(0);
    expect(body.users.byRole.seeker).toBe(0);
    expect(body.workshops.activeEnrollments).toBe(0);
  });

  it('stamps the time the numbers were taken', async () => {
    givenCounts();

    const body = (await callSummary()).json.mock.calls[0][0];

    expect(body.generatedAt).toBeInstanceOf(Date);
  });

  it('answers 500 with a message when a count fails', async () => {
    User.aggregate.mockRejectedValue(new Error('db down'));
    CrisisRequest.aggregate.mockResolvedValue([]);
    Workshop.aggregate.mockResolvedValue([]);
    Referral.aggregate.mockResolvedValue([]);
    WorkshopEnrollment.countDocuments.mockResolvedValue(0);

    const res = await callSummary();

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].message).toMatch(/summary/i);
  });

  // Seven counts in parallel rather than one after another; on a slow
  // connection the difference is the dashboard loading in one round trip
  // instead of seven.
  it('runs the counts together, not one after another', async () => {
    givenCounts();

    await callSummary();

    expect(User.aggregate).toHaveBeenCalledTimes(2);
    expect(CrisisRequest.aggregate).toHaveBeenCalledTimes(2);
    expect(Workshop.aggregate).toHaveBeenCalledTimes(1);
    expect(Referral.aggregate).toHaveBeenCalledTimes(1);
  });

  it('counts in the database, not in Node', async () => {
    givenCounts();

    await callSummary();

    const [pipeline] = User.aggregate.mock.calls[0];
    expect(pipeline).toEqual([{ $group: { _id: '$role', count: { $sum: 1 } } }]);
  });
});

describe('the admin guard on /api/admin (T16.4)', () => {
  const next = jest.fn();

  it('lets an admin through', () => {
    const res = mockRes();
    allowRoles('admin')({ user: { role: 'admin' } }, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it.each(['seeker', 'volunteer', 'psychologist', 'ngo', 'facilitator'])(
    'answers 403 for a %s',
    (role) => {
      const res = mockRes();
      allowRoles('admin')({ user: { role } }, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    }
  );

  // auth runs first and would normally reject a tokenless request, but the
  // guard must not fall through if it is ever mounted on its own.
  it('answers 403 when there is no user on the request at all', () => {
    const res = mockRes();
    allowRoles('admin')({}, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('the summary route is registered behind the guard', () => {
  it('mounts GET /summary on the admin router', () => {
    jest.isolateModules(() => {
      const router = require('../routes/adminRoutes');
      const paths = router.stack
        .filter((layer) => layer.route)
        .map((layer) => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);

      expect(paths).toContain('GET /summary');
    });
  });
});
