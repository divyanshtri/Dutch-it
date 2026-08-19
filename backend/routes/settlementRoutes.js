const express = require('express');
const router = express.Router();

const Settlement = require('../models/Settlement');
const Group = require('../models/Group');
const User = require('../models/User');
const protect = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { actionLimiter } = require('../middleware/rateLimiters');
const { createSettlementSchema } = require('../validators/settlementSchemas');

router.use(protect);

// ===== POST /api/settlements - Record a repayment between two friends =====
router.post('/', actionLimiter, validate(createSettlementSchema), async (req, res) => {
  try {
    const { groupId, payerId, receiverId, amount } = req.body;

    const groupExists = await Group.findById(groupId);
    if (!groupExists) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    const [payerExists, receiverExists] = await Promise.all([
      User.findById(payerId),
      User.findById(receiverId),
    ]);

    if (!payerExists || !receiverExists) {
      return res.status(404).json({ message: 'One or both users not found.' });
    }

    const newSettlement = new Settlement({
      group: groupId,
      payer: payerId,
      receiver: receiverId,
      amount,
    });

    const savedSettlement = await newSettlement.save();

    res.status(201).json(savedSettlement);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while recording settlement.' });
  }
});

module.exports = router;