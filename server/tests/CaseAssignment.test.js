const mongoose = require('mongoose');
const CaseAssignment = require('../models/CaseAssignment');

describe('CaseAssignment Model Unit Tests (BL-9)', () => {
  it('should validate a valid case assignment model without throwing error', async () => {
    const validAssignment = new CaseAssignment({
      request: new mongoose.Types.ObjectId(),
      volunteer: new mongoose.Types.ObjectId(),
      psychologist: new mongoose.Types.ObjectId(),
      summary: 'Initial case evaluation summary',
    });

    let err;
    try {
      await validAssignment.validate();
    } catch (error) {
      err = error;
    }

    expect(err).toBeUndefined();
  });

  it('should fail validation if required fields are missing', async () => {
    const invalidAssignment = new CaseAssignment({});

    let err;
    try {
      await invalidAssignment.validate();
    } catch (error) {
      err = error;
    }

    expect(err).toBeDefined();
    expect(err.errors.request).toBeDefined();
    expect(err.errors.volunteer).toBeDefined();
    expect(err.errors.psychologist).toBeDefined();
    expect(err.errors.summary).toBeDefined();
  });
});