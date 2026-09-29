const User = require("../models/User");
const Ngo = require("../models/Ngo");

// GET /api/ngos?category=legal_aid  (approved volunteer only)
exports.listNgos = async (req, res) => {
  try {
    if (req.user.status !== "approved") {
      return res.status(403).json({ message: "Your account is not approved yet." });
    }
    const approvedIds = await User.find({ role: "ngo", status: "approved" }).distinct("_id");
    const filter = { user: { $in: approvedIds } };
    if (req.query.category) filter.categories = req.query.category;

    const ngos = await Ngo.find(filter).select("organizationName categories address");
    res.json({ ngos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};