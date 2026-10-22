const mongoose = require('mongoose');
const Notification = require('../models/Notification');

const validData = () => ({
  user: new mongoose.Types.ObjectId(),
  type: 'request_accepted',
  message: 'Your request was accepted',
  link: '/requests/123',
});

describe('Notification model', () => {
  describe('valid data', () => {
    it('passes validation with all fields', () => {
      const notification = new Notification(validData());
      expect(notification.validateSync()).toBeUndefined();
    });

    it('passes validation without a link', () => {
      const data = validData();
      delete data.link;
      const notification = new Notification(data);
      expect(notification.validateSync()).toBeUndefined();
    });

    it('accepts every allowed type', () => {
      const types = [
        'request_accepted',
        'referral_created',
        'workshop_enrolled',
        'workshop_cancelled',
        'account_approved',
        'account_rejected',
      ];
      for (const type of types) {
        const notification = new Notification({ ...validData(), type });
        expect(notification.validateSync()).toBeUndefined();
      }
    });
  });

  describe('required fields', () => {
    it('fails without user', async () => {
      const data = validData();
      delete data.user;
      const notification = new Notification(data);
      await expect(notification.validate()).rejects.toThrow();
      expect(notification.validateSync().errors.user).toBeDefined();
    });

    it('fails without type', () => {
      const data = validData();
      delete data.type;
      const notification = new Notification(data);
      expect(notification.validateSync().errors.type).toBeDefined();
    });

    it('fails without message', () => {
      const data = validData();
      delete data.message;
      const notification = new Notification(data);
      expect(notification.validateSync().errors.message).toBeDefined();
    });

    it('fails when message is only spaces', () => {
      const notification = new Notification({ ...validData(), message: '   ' });
      expect(notification.validateSync().errors.message).toBeDefined();
    });
  });

  describe('type enum', () => {
    it('rejects an invalid type', () => {
      const notification = new Notification({ ...validData(), type: 'abc' });
      expect(notification.validateSync().errors.type).toBeDefined();
    });
  });

  describe('defaults', () => {
    it('sets read to false by default', () => {
      const notification = new Notification(validData());
      expect(notification.read).toBe(false);
    });

    it('sets link to empty string by default', () => {
      const data = validData();
      delete data.link;
      const notification = new Notification(data);
      expect(notification.link).toBe('');
    });

    it('trims the message', () => {
      const notification = new Notification({
        ...validData(),
        message: '  Hello  ',
      });
      expect(notification.message).toBe('Hello');
    });
  });

  describe('schema configuration', () => {
    it('has createdAt but no updatedAt', () => {
      expect(Notification.schema.path('createdAt')).toBeDefined();
      expect(Notification.schema.path('updatedAt')).toBeUndefined();
    });

    it('references the User model', () => {
      expect(Notification.schema.path('user').options.ref).toBe('User');
    });

    it('has the user/read/createdAt index', () => {
      const indexes = Notification.schema.indexes();
      const found = indexes.some(
        ([fields]) => fields.user === 1 && fields.read === 1 && fields.createdAt === -1
      );
      expect(found).toBe(true);
    });
  });
});