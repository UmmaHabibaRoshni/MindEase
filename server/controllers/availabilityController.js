const Availability = require("../models/Availability"); 

// @desc    Get logged-in volunteer's availability
// @route   GET /api/volunteer/availability
// @access  Private (Approved Volunteer only)
exports.getMyAvailability = async (req, res) => {
  try {
    const volunteerId = req.user.id || req.user._id;

    let availability = await Availability.findOne({ volunteer: volunteerId });

    
    if (!availability) {
      availability = await Availability.create({
        volunteer: volunteerId,
        state: "offline",
      });
    }

    return res.status(200).json({
      success: true,
      availability,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Server Error",
    });
  }
};

// @desc    Update logged-in volunteer's availability
// @route   PATCH /api/volunteer/availability
// @access  Private (Approved Volunteer only)
exports.updateAvailability = async (req, res) => {
  try {
    const { state } = req.body;
    const volunteerId = req.user.id || req.user._id;

    // Allowed status validation
    const validStates = ["available", "busy", "offline"];
    if (!state || !validStates.includes(state)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be one of: available, busy, offline",
      });
    }

    const availability = await Availability.findOneAndUpdate(
      { volunteer: volunteerId },
      { state, updatedAt: Date.now() },
      { new: true, upsert: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: "Availability status updated successfully",
      availability,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Server Error",
    });
  }
};