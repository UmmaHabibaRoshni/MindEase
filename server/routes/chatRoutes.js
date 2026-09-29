const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const allowRoles = require("../middleware/role");
const { getMessages } = require("../controllers/chatController");

router.get("/:requestId/messages", auth, allowRoles("seeker", "volunteer"), getMessages);

module.exports = router;