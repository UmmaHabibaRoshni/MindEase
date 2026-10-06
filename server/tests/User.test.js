const User = require('../models/User');

const baseUser = {
  name: 'Test User',
  email: 'test@example.com',
  password: 'hashedpassword',
};

describe('User model: T8.1 fields', () => {
  test('verifiedBy default null', () => {
    const user = new User({ ...baseUser, role: 'seeker' });
    expect(user.verifiedBy).toBeNull();
  });

  test('verifiedAt default null', () => {
    const user = new User({ ...baseUser, role: 'seeker' });
    expect(user.verifiedAt).toBeNull();
  });

  test('rejectionReason default empty string', () => {
    const user = new User({ ...baseUser, role: 'seeker' });
    expect(user.rejectionReason).toBe('');
  });
});

describe('User model: status default', () => {
  test('seeker status is approved by default', () => {
    const user = new User({ ...baseUser, role: 'seeker' });
    expect(user.status).toBe('approved');
  });

  test.each(['volunteer', 'psychologist', 'ngo', 'facilitator'])(
    '%s status is pending by default',
    (role) => {
      const user = new User({ ...baseUser, role });
      expect(user.status).toBe('pending');
    }
  );

  test('invalid status value is rejected', () => {
    const user = new User({ ...baseUser, role: 'seeker', status: 'banned' });
    const error = user.validateSync();
    expect(error.errors.status).toBeDefined();
  });
});