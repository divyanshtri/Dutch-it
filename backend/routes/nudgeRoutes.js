const express = require('express');
const router = express.Router();
const Nudge = require('../models/Nudge');
const protect = require('../middleware/authMiddleware');

router.use(protect);

// ===== POST /api/nudges - Send a payment nudge to a debtor =====
router.post('/', async (req, res) => {
  try {
    const { groupId, toUserId, amount } = req.body;
    if (!groupId || !toUserId || !amount) {
      return res.status(400).json({ message: 'groupId, toUserId, and amount are required.' });
    }
    // req.user is the creditor sending it — never trust a client-supplied
    // fromUser, same principle as createdBy on groups.
    const nudge = await Nudge.create({ group: groupId, fromUser: req.user._id, toUser: toUserId, amount });
    res.status(201).json(nudge);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while sending nudge.' });
  }
});

module.exports = router;