
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const allowRoles = require("../middleware/role");
const {
  createRequest,
  getPendingRequests,
  acceptRequest,
} = require("../controllers/requestController");

router.post("/", auth, allowRoles("seeker"), createRequest);
router.get("/pending", auth, allowRoles("volunteer"), getPendingRequests);
router.patch("/:id/accept", auth, allowRoles("volunteer"), acceptRequest);

module.exports = router;