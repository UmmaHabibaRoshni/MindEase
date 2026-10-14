const mongoose = require('mongoose');
const CaseNote = require('../models/CaseNote');

// T13.3 - unit tests for the CaseNote model (T13.1)

const TEXT_MAX = 5000;

const validate = async (doc) => {
  try {
    await doc.validate();
    return undefined;
  } catch (error) {
    return error;
  }
};

const makeNote = (overrides = {}) =>
  new CaseNote({
    assignment: new mongoose.Types.ObjectId(),
    psychologist: new mongoose.Types.ObjectId(),
    text: 'First session went well.',
    ...overrides,
  });

describe('CaseNote model (T13.1)', () => {
  it('validates a note with an assignment, a psychologist and text', async () => {
    expect(await validate(makeNote())).toBeUndefined();
  });

  it('requires assignment, psychologist and text', async () => {
    const err = await validate(new CaseNote({}));

    expect(err).toBeDefined();
    expect(err.errors.assignment).toBeDefined();
    expect(err.errors.psychologist).toBeDefined();
    expect(err.errors.text).toBeDefined();
  });

  it('rejects a note without an assignment', async () => {
    const err = await validate(makeNote({ assignment: undefined }));

    expect(err).toBeDefined();
    expect(err.errors.assignment).toBeDefined();
  });

  it('rejects a note without a psychologist', async () => {
    const err = await validate(makeNote({ psychologist: undefined }));

    expect(err).toBeDefined();
    expect(err.errors.psychologist).toBeDefined();
  });

  describe('the note text', () => {
    it('rejects empty text', async () => {
      const err = await validate(makeNote({ text: '' }));

      expect(err).toBeDefined();
      expect(err.errors.text).toBeDefined();
    });

    it('rejects text that is only spaces', async () => {
      const err = await validate(makeNote({ text: '     ' }));

      expect(err).toBeDefined();
      expect(err.errors.text).toBeDefined();
    });

    it('trims surrounding whitespace', async () => {
      const doc = makeNote({ text: '   Follow up next week.   ' });
      await validate(doc);

      expect(doc.text).toBe('Follow up next week.');
    });

    it(`rejects text longer than ${TEXT_MAX} characters`, async () => {
      const err = await validate(makeNote({ text: 'x'.repeat(TEXT_MAX + 1) }));

      expect(err).toBeDefined();
      expect(err.errors.text).toBeDefined();
    });

    it(`accepts text of exactly ${TEXT_MAX} characters`, async () => {
      expect(await validate(makeNote({ text: 'x'.repeat(TEXT_MAX) }))).toBeUndefined();
    });
  });

  describe('schema setup', () => {
    it('is registered as CaseNote', () => {
      expect(CaseNote.modelName).toBe('CaseNote');
    });

    it('points assignment at CaseAssignment and psychologist at User', () => {
      expect(CaseNote.schema.path('assignment').options.ref).toBe('CaseAssignment');
      expect(CaseNote.schema.path('psychologist').options.ref).toBe('User');
    });

    it('has timestamps', () => {
      expect(CaseNote.schema.options.timestamps).toBe(true);
      expect(CaseNote.schema.path('createdAt')).toBeDefined();
      expect(CaseNote.schema.path('updatedAt')).toBeDefined();
    });

    it('has an index for listing the notes of an assignment, newest first', () => {
      const hasIndex = CaseNote.schema
        .indexes()
        .some(([fields]) => fields.assignment === 1 && fields.createdAt === -1);

      expect(hasIndex).toBe(true);
    });
  });
});