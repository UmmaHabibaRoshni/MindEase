const mongoose = require('mongoose');
const Workshop = require('../models/Workshop');
const Payment = require('../models/Payment');

/**
 * T17.2 - Unit tests for the workshop price field and the Payment model.
 *
 * Same style as workshopModel.test.js: documents are validated in memory, no
 * database runs. Validation is where the money rules live, so these cover the
 * boundary between "free" and "paid" closely - that boundary decides whether a
 * seeker is enrolled straight away or sent to a payment gateway.
 */

const validateModel = async (doc) => {
  try {
    await doc.validate();
    return undefined;
  } catch (error) {
    return error;
  }
};

describe('T17.2 - Workshop price field', () => {
  let facilitatorId;

  beforeAll(() => {
    facilitatorId = new mongoose.Types.ObjectId();
  });

  const makeWorkshop = (overrides = {}) => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    return new Workshop({
      title: 'Mindfulness and Anxiety Management Masterclass',
      description: 'A comprehensive interactive workshop helping people navigate stress.',
      facilitator: facilitatorId,
      date: futureDate,
      time: '10:30 AM',
      mode: 'Online',
      locationOrLink: 'https://meet.example.com/t17-2',
      capacity: 20,
      ...overrides,
    });
  };

  it('is optional: a workshop with no price is valid', async () => {
    const workshop = makeWorkshop();
    expect(await validateModel(workshop)).toBeUndefined();
    expect(workshop.price).toBeUndefined();
  });

  it('has no default value, so "not set" stays distinct from 0', () => {
    expect(makeWorkshop().price).toBeUndefined();
  });

  it('accepts a positive price', async () => {
    const workshop = makeWorkshop({ price: 500 });
    expect(await validateModel(workshop)).toBeUndefined();
    expect(workshop.price).toBe(500);
  });

  it('accepts 0 and treats it as free', async () => {
    const workshop = makeWorkshop({ price: 0 });
    expect(await validateModel(workshop)).toBeUndefined();
    expect(workshop.isPaid).toBe(false);
  });

  it('accepts a decimal amount', async () => {
    const workshop = makeWorkshop({ price: 499.5 });
    expect(await validateModel(workshop)).toBeUndefined();
    expect(workshop.isPaid).toBe(true);
  });

  it('refuses a negative price', async () => {
    const error = await validateModel(makeWorkshop({ price: -1 }));
    expect(error).toBeDefined();
    expect(error.errors.price).toBeDefined();
    expect(error.errors.price.message).toMatch(/cannot be negative/i);
  });

  it('refuses a price that is not a number', async () => {
    const error = await validateModel(makeWorkshop({ price: 'five hundred' }));
    expect(error).toBeDefined();
    expect(error.errors.price).toBeDefined();
  });

  it('casts a numeric string, which is what an HTML number input sends', async () => {
    const workshop = makeWorkshop({ price: '500' });
    expect(await validateModel(workshop)).toBeUndefined();
    expect(workshop.price).toBe(500);
    expect(workshop.isPaid).toBe(true);
  });

  describe('isPaid virtual', () => {
    it('is false when no price was ever set', () => {
      expect(makeWorkshop().isPaid).toBe(false);
    });

    it('is false for 0', () => {
      expect(makeWorkshop({ price: 0 }).isPaid).toBe(false);
    });

    it('is true for any amount above 0', () => {
      expect(makeWorkshop({ price: 0.5 }).isPaid).toBe(true);
      expect(makeWorkshop({ price: 1000 }).isPaid).toBe(true);
    });

    it('is exposed in JSON, which is how the frontend decides the button', () => {
      const json = makeWorkshop({ price: 500 }).toJSON();
      expect(json.isPaid).toBe(true);
      expect(json.price).toBe(500);
    });

    it('still reports free in JSON when the price is missing', () => {
      expect(makeWorkshop().toJSON().isPaid).toBe(false);
    });
  });
});

describe('T17.2 - Payment model', () => {
  let workshopId;
  let seekerId;

  beforeAll(() => {
    workshopId = new mongoose.Types.ObjectId();
    seekerId = new mongoose.Types.ObjectId();
  });

  const makePayment = (overrides = {}) =>
    new Payment({
      workshop: workshopId,
      seeker: seekerId,
      amount: 500,
      tranId: 'ME1730000000abcd1234',
      ...overrides,
    });

  it('validates a complete payment', async () => {
    expect(await validateModel(makePayment())).toBeUndefined();
  });

  it('starts as pending, so nothing counts as paid until a callback says so', () => {
    expect(makePayment().status).toBe('pending');
  });

  it('has no valId or paidAt until the gateway confirms', () => {
    const payment = makePayment();
    expect(payment.valId).toBeNull();
    expect(payment.paidAt).toBeNull();
  });

  it('requires the workshop', async () => {
    const error = await validateModel(makePayment({ workshop: undefined }));
    expect(error.errors.workshop).toBeDefined();
  });

  it('requires the seeker', async () => {
    const error = await validateModel(makePayment({ seeker: undefined }));
    expect(error.errors.seeker).toBeDefined();
  });

  it('requires a transaction id', async () => {
    const error = await validateModel(makePayment({ tranId: undefined }));
    expect(error.errors.tranId).toBeDefined();
  });

  it('trims the transaction id', async () => {
    const payment = makePayment({ tranId: '  ME123  ' });
    await validateModel(payment);
    expect(payment.tranId).toBe('ME123');
  });

  it('requires an amount', async () => {
    const error = await validateModel(makePayment({ amount: undefined }));
    expect(error.errors.amount).toBeDefined();
  });

  it('refuses an amount of 0: a free workshop must never create a payment', async () => {
    const error = await validateModel(makePayment({ amount: 0 }));
    expect(error).toBeDefined();
    expect(error.errors.amount).toBeDefined();
    expect(error.errors.amount.message).toMatch(/greater than 0/i);
  });

  it('refuses a negative amount', async () => {
    const error = await validateModel(makePayment({ amount: -100 }));
    expect(error.errors.amount).toBeDefined();
  });

  it.each(['pending', 'success', 'failed', 'cancelled'])(
    'accepts the %s status',
    async (status) => {
      expect(await validateModel(makePayment({ status }))).toBeUndefined();
    }
  );

  it('refuses a status outside the list', async () => {
    const error = await validateModel(makePayment({ status: 'refunded' }));
    expect(error).toBeDefined();
    expect(error.errors.status).toBeDefined();
  });

  it('exports the status list so other code does not retype it', () => {
    expect(Payment.PAYMENT_STATUSES).toEqual([
      'pending',
      'success',
      'failed',
      'cancelled',
    ]);
  });

  it('keeps tranId unique in the schema, so a callback cannot be replayed onto a second row', () => {
    expect(Payment.schema.path('tranId').options.unique).toBe(true);
  });

  it('indexes workshop, seeker and status together for the already-paid lookup', () => {
    const indexes = Payment.schema.indexes().map(([fields]) => fields);
    expect(indexes).toContainEqual({ workshop: 1, seeker: 1, status: 1 });
  });
});
