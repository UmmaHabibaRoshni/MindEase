const VolunteerAvailability = require('../models/VolunteerAvailability');

// @desc    Get logged-in volunteer's availability
// @route   GET /api/volunteer/availability
// @access  Private (Approved Volunteer only)
exports.getMyAvailability = async (req, res) => {
  try {
    const volunteerId = req.user.id || req.user._id;

    let availability = await VolunteerAvailability.findOne({ volunteer: volunteerId });

    if (!availability) {
      availability = await VolunteerAvailability.create({
        volunteer: volunteerId,
        isAvailable: false,
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
    const { isAvailable, dayOfWeek, startTime, endTime } = req.body;
    const volunteerId = req.user.id || req.user._id;

    const updateFields = {};
    if (typeof isAvailable !== 'undefined') updateFields.isAvailable = isAvailable;
    if (dayOfWeek) updateFields.dayOfWeek = dayOfWeek;
    if (startTime) updateFields.startTime = startTime;
    if (endTime) updateFields.endTime = endTime;
    updateFields.updatedAt = Date.now();

    const availability = await VolunteerAvailability.findOneAndUpdate(
      { volunteer: volunteerId },
      updateFields,
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