const express = require('express');
const router = express.Router();

const User = require('../models/User');
const protect = require('../middleware/authMiddleware');
const mongoose = require('mongoose');
const mergeGhostUser = require('../utils/mergeGhostUser');
const { actionLimiter } = require('../middleware/rateLimiters');

// Protect all user routes
router.use(protect);

// ===== GET /api/users - Fetch users for adding to groups or friends =====
router.get('/', async (req, res) => {
  try {
    // Exclude the logged-in user themselves and omit passwords/sensitive fields
    const users = await User.find({ _id: { $ne: req.user._id } })
      .select('-password');

    res.status(200).json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while fetching users.' });
  }
});

// ===== POST /api/users/claim-ghost - Merge a matching guest profile into this account =====
router.post('/claim-ghost', actionLimiter, async (req, res, next) => {
  try {
    const { ghostUserId } = req.body;
    let ghost;
    if (ghostUserId) {
      if (!mongoose.isValidObjectId(ghostUserId)) {
        return res.status(400).json({ message: 'Invalid guest profile ID.' });
      }
      ghost = await User.findOne({ _id: ghostUserId, isGhost: true });
    } else {
      const matches = [
        req.user.email && { email: req.user.email },
        req.user.phoneNumber && { phoneNumber: req.user.phoneNumber },
      ].filter(Boolean);
      if (!matches.length) return res.status(400).json({ message: 'Your profile has no claimable contact information.' });
      ghost = await User.findOne({ isGhost: true, $or: matches });
    }

    if (!ghost) return res.status(404).json({ message: 'Matching guest profile not found.' });
    const contactMatches =
      (ghost.email && req.user.email && ghost.email === req.user.email) ||
      (ghost.phoneNumber && req.user.phoneNumber && ghost.phoneNumber === req.user.phoneNumber);
    if (!contactMatches) {
      return res.status(403).json({ message: 'This guest profile does not match your verified contact information.' });
    }

    await mergeGhostUser(ghost._id, req.user._id);
    return res.status(200).json({ message: 'Guest history merged into your account.' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
