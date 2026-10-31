
const mongoose = require('mongoose');

const PAYMENT_STATUSES = ['pending', 'success', 'failed', 'cancelled'];

/**
 * Payment Schema
 * One record per payment attempt for a paid workshop.
 * Created as "pending" when the seeker clicks Pay & Enroll, and updated by
 * the gateway callbacks. The enrollment is only created after the backend
 * has verified the payment with SSLCommerz.
 */
const paymentSchema = new mongoose.Schema(
  {
    workshop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workshop',
      required: [true, 'Workshop reference is required'],
      index: true,
    },
    seeker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Seeker reference is required'],
      index: true,
    },
    // price of the workshop at the moment the payment was started
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [0.01, 'Payment amount must be greater than 0'],
    },
    // our own transaction id, sent to SSLCommerz as tran_id
    tranId: {
      type: String,
      required: [true, 'Transaction id is required'],
      unique: true,
      trim: true,
    },
    status: {
      type: String,
      enum: {
        values: PAYMENT_STATUSES,
        message: '{VALUE} is not a valid payment status',
      },
      default: 'pending',
      index: true,
    },
    // from the gateway, saved when the payment is verified
    valId: { type: String, default: null, trim: true },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

paymentSchema.index({ workshop: 1, seeker: 1, status: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
module.exports.PAYMENT_STATUSES = PAYMENT_STATUSES;