// T15.4 (BL-15) - unit tests for the notification controller and its role guard.
// The model is mocked, so no database runs.

jest.mock('../models/Notification', () => ({
  find: jest.fn(),
  countDocuments: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateMany: jest.fn(),
}));

const Notification = require('../models/Notification');
const allowRoles = require('../middleware/role');
const {
  listMyNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
} = require('../controllers/notificationController');

const me = '507f1f77bcf86cd799439011';
const notificationId = '507f1f77bcf86cd799439022';

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const reqFor = (extra = {}) => ({ user: { id: me, role: 'seeker' }, params: {}, query: {}, ...extra });

// Notification.find(...).sort(...).limit(...) resolves to the list
function givenList(list) {
  const limit = jest.fn().mockResolvedValue(list);
  const sort = jest.fn().mockReturnValue({ limit });
  Notification.find.mockReturnValue({ sort });
  return { sort, limit };
}

beforeEach(() => {
  jest.resetAllMocks();
});

describe('listMyNotifications', () => {
  test('returns only the caller\'s notifications, newest first', async () => {
    const list = [{ _id: 'n2' }, { _id: 'n1' }];
    const { sort } = givenList(list);
    const res = mockRes();

    await listMyNotifications(reqFor(), res);

    expect(Notification.find).toHaveBeenCalledWith({ user: me });
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(res.json).toHaveBeenCalledWith({ notifications: list });
  });

  test('?unread=true only asks for unread ones', async () => {
    givenList([]);

    await listMyNotifications(reqFor({ query: { unread: 'true' } }), mockRes());

    expect(Notification.find).toHaveBeenCalledWith({ user: me, read: false });
  });

  test('uses a default limit of 20', async () => {
    const { limit } = givenList([]);

    await listMyNotifications(reqFor(), mockRes());

    expect(limit).toHaveBeenCalledWith(20);
  });

  test('honours ?limit but never goes above 50', async () => {
    const first = givenList([]);
    await listMyNotifications(reqFor({ query: { limit: '5' } }), mockRes());
    expect(first.limit).toHaveBeenCalledWith(5);

    const second = givenList([]);
    await listMyNotifications(reqFor({ query: { limit: '9999' } }), mockRes());
    expect(second.limit).toHaveBeenCalledWith(50);
  });

  test.each(['abc', '0', '-3', ''])('falls back to the default for limit "%s"', async (value) => {
    const { limit } = givenList([]);

    await listMyNotifications(reqFor({ query: { limit: value } }), mockRes());

    expect(limit).toHaveBeenCalledWith(20);
  });

  test('returns an empty list, not an error, when there are none', async () => {
    givenList([]);
    const res = mockRes();

    await listMyNotifications(reqFor(), res);

    expect(res.json).toHaveBeenCalledWith({ notifications: [] });
  });

  test('returns 500 when the database fails', async () => {
    Notification.find.mockImplementation(() => {
      throw new Error('db down');
    });
    const res = mockRes();

    await listMyNotifications(reqFor(), res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('getUnreadCount', () => {
  test('counts the caller\'s unread notifications only', async () => {
    Notification.countDocuments.mockResolvedValue(3);
    const res = mockRes();

    await getUnreadCount(reqFor(), res);

    expect(Notification.countDocuments).toHaveBeenCalledWith({ user: me, read: false });
    expect(res.json).toHaveBeenCalledWith({ count: 3 });
  });

  test('is 0 when everything is read', async () => {
    Notification.countDocuments.mockResolvedValue(0);
    const res = mockRes();

    await getUnreadCount(reqFor(), res);

    expect(res.json).toHaveBeenCalledWith({ count: 0 });
  });

  test('returns 500 when the database fails', async () => {
    Notification.countDocuments.mockRejectedValue(new Error('db down'));
    const res = mockRes();

    await getUnreadCount(reqFor(), res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('markRead', () => {
  test('marks one of the caller\'s notifications as read', async () => {
    const updated = { _id: notificationId, user: me, read: true };
    Notification.findOneAndUpdate.mockResolvedValue(updated);
    const res = mockRes();

    await markRead(reqFor({ params: { id: notificationId } }), res);

    expect(Notification.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: notificationId, user: me },
      { read: true },
      { new: true }
    );
    expect(res.json).toHaveBeenCalledWith({ notification: updated });
  });

  // The user is part of the filter, so someone else's notification looks
  // exactly like one that does not exist.
  test('answers 404 for a notification that is not the caller\'s', async () => {
    Notification.findOneAndUpdate.mockResolvedValue(null);
    const res = mockRes();

    await markRead(reqFor({ params: { id: notificationId } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('answers 400 for a malformed id without touching the database', async () => {
    const res = mockRes();

    await markRead(reqFor({ params: { id: '123' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Notification.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('returns 500 when the database fails', async () => {
    Notification.findOneAndUpdate.mockRejectedValue(new Error('db down'));
    const res = mockRes();

    await markRead(reqFor({ params: { id: notificationId } }), res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('markAllRead', () => {
  test('marks every unread notification of the caller as read', async () => {
    Notification.updateMany.mockResolvedValue({ modifiedCount: 4 });
    const res = mockRes();

    await markAllRead(reqFor(), res);

    expect(Notification.updateMany).toHaveBeenCalledWith({ user: me, read: false }, { read: true });
    expect(res.json).toHaveBeenCalledWith({ modified: 4 });
  });

  test('reports 0 when there was nothing to mark', async () => {
    Notification.updateMany.mockResolvedValue({ modifiedCount: 0 });
    const res = mockRes();

    await markAllRead(reqFor(), res);

    expect(res.json).toHaveBeenCalledWith({ modified: 0 });
  });

  test('returns 500 when the database fails', async () => {
    Notification.updateMany.mockRejectedValue(new Error('db down'));
    const res = mockRes();

    await markAllRead(reqFor(), res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('role guard on /api/notifications', () => {
  const ALL_ROLES = ['seeker', 'volunteer', 'psychologist', 'ngo', 'facilitator', 'admin'];

  it.each(ALL_ROLES)('lets a %s through', (role) => {
    const next = jest.fn();
    allowRoles(...ALL_ROLES)({ user: { role } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('blocks a request with no user with 403', () => {
    const next = jest.fn();
    const res = mockRes();
    allowRoles(...ALL_ROLES)({}, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('blocks an unknown role with 403', () => {
    const next = jest.fn();
    const res = mockRes();
    allowRoles(...ALL_ROLES)({ user: { role: 'hacker' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('the notification routes are registered', () => {
  test('mounts the four routes, with read-all before /:id/read', () => {
    jest.isolateModules(() => {
      const router = require('../routes/notificationRoutes');
      const paths = router.stack
        .filter((layer) => layer.route)
        .map((layer) => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);

      expect(paths).toEqual([
        'GET /',
        'GET /unread-count',
        'PATCH /read-all',
        'PATCH /:id/read',
      ]);
    });
  });

  test('app.js mounts them at /api/notifications', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    expect(source).toContain("'/api/notifications'");
  });
});
