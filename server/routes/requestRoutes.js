
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const allowRoles = require("../middleware/role");
const {
  createRequest,
  getMyRequests,
  getPendingRequests,
  getAcceptedRequests,
  acceptRequest,
} = require("../controllers/requestController");

// Seeker routes
router.post("/", auth, allowRoles("seeker"), createRequest);
router.get("/mine", auth, allowRoles("seeker"), getMyRequests);

// Volunteer routes
router.get("/pending", auth, allowRoles("volunteer"), getPendingRequests);
router.get("/accepted", auth, allowRoles("volunteer"), getAcceptedRequests);
router.patch("/:id/accept", auth, allowRoles("volunteer"), acceptRequest);

module.exports = router;