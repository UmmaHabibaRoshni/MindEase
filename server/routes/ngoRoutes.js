const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const allowRoles = require("../middleware/role");
const { listNgos } = require("../controllers/ngoController");

router.get("/", auth, allowRoles("volunteer"), listNgos);

module.exports = router;