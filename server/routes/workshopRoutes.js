
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const allowRoles = require("../middleware/role");
const { startPayment } = require("../controllers/paymentController");
const {
  createWorkshop,
  updateWorkshop,
  cancelWorkshop,
  listAvailableWorkshops,
  enroll,
  cancelEnrollment,
} = require("../controllers/workshopController");


router.post("/", auth, allowRoles("facilitator"), createWorkshop);
router.patch("/:id", auth, allowRoles("facilitator"), updateWorkshop);
router.patch("/:id/cancel", auth, allowRoles("facilitator"), cancelWorkshop);

router.get("/available", auth, allowRoles("seeker"), listAvailableWorkshops);
router.post("/:id/enroll", auth, allowRoles("seeker"), enroll);
router.delete("/:id/enroll", auth, allowRoles("seeker"), cancelEnrollment);
router.post("/:id/pay", auth, allowRoles("seeker"), startPayment);

module.exports = router;