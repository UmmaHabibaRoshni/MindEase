const mongoose = require('mongoose');
const Referral = require('../models/Referral');
const { REFERRAL_STATUSES, RESPONDED_STATUSES, NOTE_MAX } = require('../models/Referral');

// T14.3 - unit tests for the referral status and NGO response fields (T14.1)

const validate = async (doc) => {
  try {
    await doc.validate();
    return undefined;
  } catch (error) {
    return error;
  }
};

const makeReferral = (overrides = {}) =>
  new Referral({
    request: new mongoose.Types.ObjectId(),
    referredBy: new mongoose.Types.ObjectId(),
    ngo: new mongoose.Types.ObjectId(),
    consentGiven: true,
    consentAt: new Date(),
    ...overrides,
  });

describe('Referral model (T14.1)', () => {
  it('validates a referral with consent and no response yet', async () => {
    const doc = makeReferral();

    expect(await validate(doc)).toBeUndefined();
    expect(doc.status).toBe('pending');
    expect(doc.note).toBe('');
    expect(doc.respondedAt).toBeNull();
    expect(doc.respondedBy).toBeNull();
  });

  it('requires the core referral fields', async () => {
    const err = await validate(new Referral({}));

    expect(err).toBeDefined();
    expect(err.errors.request).toBeDefined();
    expect(err.errors.referredBy).toBeDefined();
    expect(err.errors.ngo).toBeDefined();
    expect(err.errors.consentGiven).toBeDefined();
    expect(err.errors.consentAt).toBeDefined();
  });

  it('rejects a status outside the allowed list', async () => {
    const err = await validate(makeReferral({ status: 'maybe_later' }));

    expect(err).toBeDefined();
    expect(err.errors.status).toBeDefined();
  });

  it.each(REFERRAL_STATUSES)('accepts the status %s', async (status) => {
    expect(await validate(makeReferral({ status }))).toBeUndefined();
  });

  describe('the NGO response note', () => {
    it('trims surrounding whitespace', async () => {
      const doc = makeReferral({ status: 'in_progress', note: '   We have contacted her.   ' });
      await validate(doc);

      expect(doc.note).toBe('We have contacted her.');
    });

    it(`rejects a note longer than ${NOTE_MAX} characters`, async () => {
      const err = await validate(makeReferral({ note: 'x'.repeat(NOTE_MAX + 1) }));

      expect(err).toBeDefined();
      expect(err.errors.note).toBeDefined();
    });

    it(`accepts a note of exactly ${NOTE_MAX} characters`, async () => {
      expect(await validate(makeReferral({ note: 'x'.repeat(NOTE_MAX) }))).toBeUndefined();
    });
  });

  describe('respondedAt stamping', () => {
    it.each(RESPONDED_STATUSES)('is set automatically when the status becomes %s', async (status) => {
      const doc = makeReferral({ status });

      await validate(doc);

      expect(doc.respondedAt).toBeInstanceOf(Date);
    });

    it('stays null while the referral is pending', async () => {
      const doc = makeReferral({ status: 'pending' });

      await validate(doc);

      expect(doc.respondedAt).toBeNull();
    });

    it('does not overwrite the time of the first response', async () => {
      const firstResponse = new Date('2026-10-01T10:00:00.000Z');
      const doc = makeReferral({ status: 'in_progress', respondedAt: firstResponse });

      await validate(doc);
      doc.status = 'resolved';
      await validate(doc);

      expect(doc.respondedAt).toEqual(firstResponse);
    });

    it('clears the response if the referral goes back to pending', async () => {
      const responder = new mongoose.Types.ObjectId();
      const doc = makeReferral({ status: 'resolved', respondedBy: responder });
      await validate(doc);
      expect(doc.respondedAt).toBeInstanceOf(Date);

      doc.status = 'pending';
      await validate(doc);

      expect(doc.respondedAt).toBeNull();
      expect(doc.respondedBy).toBeNull();
    });

    it('records which NGO user answered', async () => {
      const responder = new mongoose.Types.ObjectId();
      const doc = makeReferral({ status: 'in_progress', respondedBy: responder, note: 'Case opened.' });

      expect(await validate(doc)).toBeUndefined();
      expect(String(doc.respondedBy)).toBe(String(responder));
    });
  });

  describe('exports', () => {
    it('lists the four referral statuses', () => {
      expect(REFERRAL_STATUSES).toEqual(['pending', 'in_progress', 'resolved', 'closed']);
    });

    it('treats every status except pending as answered', () => {
      expect(RESPONDED_STATUSES).toEqual(['in_progress', 'resolved', 'closed']);
      expect(RESPONDED_STATUSES).not.toContain('pending');
    });

    it('matches the schema enum', () => {
      expect(Referral.schema.path('status').enumValues).toEqual(REFERRAL_STATUSES);
    });
  });
});
