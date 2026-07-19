const express = require('express');
const router = express.Router();

const Settlement = require('../models/Settlement');
const Group = require('../models/Group');
const User = require('../models/User');

// ===== POST /api/settlements - Record a repayment between two friends =====
router.post('/', async (req, res) => {
  try {
    const { groupId, payerId, receiverId, amount } = req.body;

    if (!groupId || !payerId || !receiverId || amount === undefined) {
      return res.status(400).json({
        message: 'groupId, payerId, receiverId, and amount are all required.',
      });
    }

    if (amount <= 0) {
      return res.status(400).json({ message: 'Settlement amount must be greater than 0.' });
    }

    if (payerId === receiverId) {
      return res.status(400).json({ message: 'payerId and receiverId cannot be the same person.' });
    }

    // Validate that the group and both users actually exist, same pattern
    // as your existing group-creation validation.
    const groupExists = await Group.findById(groupId);
    if (!groupExists) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    const [payerExists, receiverExists] = await Promise.all([
      User.findById(payerId),
      User.findById(receiverId),
    ]);
    // Promise.all() runs both these lookups CONCURRENTLY instead of one after
    // the other — since they don't depend on each other's results, there's no
    // reason to wait for the first to finish before starting the second.
    // This is a small but good habit: it roughly halves the wait time here
    // compared to two separate `await` calls in sequence.

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