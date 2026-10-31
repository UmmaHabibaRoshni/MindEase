const crypto = require("crypto");
const mongoose = require("mongoose");
const Workshop = require("../models/Workshop");
const WorkshopEnrollment = require("../models/WorkshopEnrollment");
const Payment = require("../models/Payment");
const User = require("../models/User");
const { notify } = require("../utils/notify");

const SSLC_SESSION_URL = "https://sandbox.sslcommerz.com/gwprocess/v4/api.php";
const SSLC_VALIDATE_URL =
  "https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php";

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// ---------- T17.3 start payment ----------

// POST /api/workshops/:id/pay  (seeker)
// Saves a pending payment and returns the gateway URL. The enrollment is NOT
// created here; that only happens after the callbacks verify the payment.
exports.startPayment = async (req, res) => {
  const { id } = req.params;
  try {
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid workshop id" });
    }

    const { SSLC_STORE_ID, SSLC_STORE_PASSWD, BACKEND_URL } = process.env;
    if (!SSLC_STORE_ID || !SSLC_STORE_PASSWD || !BACKEND_URL) {
      return res.status(500).json({ message: "Payment gateway is not configured" });
    }

    const workshop = await Workshop.findById(id);
    if (!workshop) return res.status(404).json({ message: "Workshop not found" });

    if (workshop.status !== "Scheduled" || workshop.date < startOfToday()) {
      return res.status(400).json({ message: "Workshop is not open for enrollment" });
    }
    if (!workshop.isPaid) {
      return res.status(400).json({ message: "This workshop is free. Use Enroll." });
    }
    if (workshop.isFull) {
      return res.status(409).json({ message: "Workshop is full" });
    }

    const already = await WorkshopEnrollment.findOne({
      workshop: id,
      seeker: req.user.id,
      status: "Enrolled",
    });
    if (already) return res.status(409).json({ message: "You are already enrolled" });

    const seeker = await User.findById(req.user.id).select("name email phone");

    // amount always comes from the database, never from the request
    const payment = await Payment.create({
      workshop: id,
      seeker: req.user.id,
      amount: workshop.price,
      tranId: `ME${Date.now()}${crypto.randomBytes(4).toString("hex")}`,
    });

    const params = new URLSearchParams({
      store_id: SSLC_STORE_ID.trim(),
      store_passwd: SSLC_STORE_PASSWD.trim(),
      total_amount: workshop.price.toFixed(2),
      currency: "BDT",
      tran_id: payment.tranId,
      success_url: `${BACKEND_URL}/api/payments/success`,
      fail_url: `${BACKEND_URL}/api/payments/fail`,
      cancel_url: `${BACKEND_URL}/api/payments/cancel`,
      product_name: workshop.title.slice(0, 100),
      product_category: "Workshop",
      product_profile: "general",
      num_of_item: "1",
      shipping_method: "NO",
      cus_name: seeker.name,
      cus_email: seeker.email,
      // the gateway insists on these; we do not collect or store them
      cus_add1: "N/A",
      cus_city: "Dhaka",
      cus_state: "Dhaka",
      cus_postcode: "1000",
      cus_country: "Bangladesh",
      cus_phone: seeker.phone || "01700000000",
    });

    let data = null;
    try {
      const r = await fetch(SSLC_SESSION_URL, { method: "POST", body: params });
      data = await r.json();
    } catch (err) {
      console.error("SSLCommerz session error:", err.message);
    }

    if (!data || data.status !== "SUCCESS" || !data.GatewayPageURL) {
      console.error(
        "SSLCommerz session failed:",
        data ? { status: data.status, reason: data.failedreason } : "no response"
      );
      payment.status = "failed";
      await payment.save();
      return res.status(502).json({ message: "Could not start the payment. Try again." });
    }

    res.json({ gatewayUrl: data.GatewayPageURL });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ---------- T17.4 callbacks (no JWT: the gateway redirects the browser here) ----------

const frontend = (path) =>
  `${(process.env.FRONTEND_URL || "").trim().replace(/\/$/, "")}${path}`;

// 303 turns the gateway's POST into a GET on the React page
const goTo = (res, path) => res.redirect(303, frontend(path));

// asks SSLCommerz whether this payment really happened; returns its answer or null
const validateWithGateway = async (valId) => {
  try {
    const qs = new URLSearchParams({
      val_id: valId,
      store_id: process.env.SSLC_STORE_ID.trim(),
      store_passwd: process.env.SSLC_STORE_PASSWD.trim(),
      format: "json",
    });
    const r = await fetch(`${SSLC_VALIDATE_URL}?${qs.toString()}`);
    return await r.json();
  } catch (err) {
    console.error("SSLCommerz validation error:", err.message);
    return null;
  }
};

// takes one seat and creates (or re-activates) the enrollment.
// returns "enrolled", "already" or "unavailable"
const enrollAfterPayment = async (workshopId, seekerId) => {
  const workshop = await Workshop.findOneAndUpdate(
    {
      _id: workshopId,
      status: "Scheduled",
      date: { $gte: startOfToday() },
      $expr: { $lt: ["$enrolledCount", "$capacity"] },
    },
    { $inc: { enrolledCount: 1 } }
  );
  if (!workshop) return { result: "unavailable" };

  let enrollment = await WorkshopEnrollment.findOneAndUpdate(
    { workshop: workshopId, seeker: seekerId, status: "Cancelled" },
    {
      $set: {
        status: "Enrolled",
        enrolledAt: new Date(),
        cancellationReason: null,
        cancelledAt: null,
      },
    },
    { returnDocument: "after" }
  );
  if (!enrollment) {
    try {
      enrollment = await WorkshopEnrollment.create({
        workshop: workshopId,
        seeker: seekerId,
      });
    } catch (err) {
      // give the seat back
      await Workshop.updateOne({ _id: workshopId }, { $inc: { enrolledCount: -1 } });
      if (err.code === 11000) return { result: "already" };
      throw err;
    }
  }

  await notify(
    seekerId,
    "workshop_enrolled",
    `You are enrolled in "${workshop.title}".`,
    "/dashboard/workshops"
  );
  return { result: "enrolled" };
};

// POST /api/payments/success
exports.paymentSuccess = async (req, res) => {
  try {
    const tranId = String(req.body.tran_id || "");
    const valId = String(req.body.val_id || "");
    if (!tranId || !valId) return goTo(res, "/payment/fail?reason=invalid");

    const payment = await Payment.findOne({ tranId });
    if (!payment) return goTo(res, "/payment/fail?reason=invalid");

    // already handled (page refreshed, or the callback came twice)
    if (payment.status === "success") {
      return goTo(res, `/payment/success?workshop=${payment.workshop}`);
    }
    if (payment.status !== "pending") {
      return goTo(res, "/payment/fail?reason=invalid");
    }

    // verify with SSLCommerz: never trust the form fields alone
    const v = await validateWithGateway(valId);
    const okStatus = v && (v.status === "VALID" || v.status === "VALIDATED");
    const okTran = v && String(v.tran_id) === payment.tranId;
    const okAmount =
      v && Number(v.amount).toFixed(2) === Number(payment.amount).toFixed(2);
    const okCurrency = v && (!v.currency_type || v.currency_type === "BDT");

    if (!okStatus || !okTran || !okAmount || !okCurrency) {
      console.error("Payment verification failed for", tranId, {
        status: v && v.status,
        tranMatch: !!okTran,
        amountMatch: !!okAmount,
      });
      payment.status = "failed";
      await payment.save();
      return goTo(res, "/payment/fail?reason=verify");
    }

    // payment is real: take the seat again (capacity can change while paying)
    const { result } = await enrollAfterPayment(payment.workshop, payment.seeker);

    payment.valId = valId;
    payment.paidAt = new Date();

    if (result === "unavailable") {
      // verified paid, but the workshop filled up or was cancelled meanwhile.
      // there are no refunds in the app, so this needs handling by hand.
      console.error("PAID BUT NOT ENROLLED, check manually:", tranId);
      payment.status = "failed";
      await payment.save();
      return goTo(res, "/payment/fail?reason=unavailable");
    }

    payment.status = "success";
    await payment.save();
    return goTo(res, `/payment/success?workshop=${payment.workshop}`);
  } catch (err) {
    console.error(err);
    return goTo(res, "/payment/fail?reason=error");
  }
};

// POST /api/payments/fail
exports.paymentFail = async (req, res) => {
  try {
    const tranId = String(req.body.tran_id || "");
    if (tranId) {
      await Payment.updateOne({ tranId, status: "pending" }, { status: "failed" });
    }
    return goTo(res, "/payment/fail?reason=gateway");
  } catch (err) {
    console.error(err);
    return goTo(res, "/payment/fail?reason=error");
  }
};

// POST /api/payments/cancel
exports.paymentCancel = async (req, res) => {
  try {
    const tranId = String(req.body.tran_id || "");
    if (tranId) {
      await Payment.updateOne({ tranId, status: "pending" }, { status: "cancelled" });
    }
    return goTo(res, "/payment/cancel");
  } catch (err) {
    console.error(err);
    return goTo(res, "/payment/fail?reason=error");
  }
};