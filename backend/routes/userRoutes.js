const express = require('express');
const router = express.Router();

const User = require('../models/User');
const protect = require('../middleware/authMiddleware');

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

module.exports = router;