const express = require("express");
const router = express.Router();
const {
  paymentSuccess,
  paymentFail,
  paymentCancel,
} = require("../controllers/paymentController");

// no auth: the payment gateway sends the seeker's browser here.
// Safety comes from verifying with SSLCommerz, not from a token.
router.post("/success", paymentSuccess);
router.post("/fail", paymentFail);
router.post("/cancel", paymentCancel);

module.exports = router;