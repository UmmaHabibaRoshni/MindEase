
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const allowRoles = require("../middleware/role");
const {
  createWorkshop,
  updateWorkshop,
  cancelWorkshop,
} = require("../controllers/workshopController");

router.post("/", auth, allowRoles("facilitator"), createWorkshop);
router.patch("/:id", auth, allowRoles("facilitator"), updateWorkshop);
router.patch("/:id/cancel", auth, allowRoles("facilitator"), cancelWorkshop);

module.exports = router;