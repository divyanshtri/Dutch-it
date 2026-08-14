const express = require('express');
const router = express.Router();
const Group = require('../models/Group');
const Expense = require('../models/Expense');
const Settlement = require('../models/Settlement');
const protect = require('../middleware/authMiddleware');

router.use(protect);

// ===== GET /api/activity - Recent expenses & settlements across the user's groups =====
router.get('/', async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user._id }).select('_id name');
    const groupIds = groups.map((g) => g._id);
    const groupNameById = {};
    groups.forEach((g) => { groupNameById[g._id.toString()] = g.name; });

    const [expenses, settlements] = await Promise.all([
      Expense.find({ group: { $in: groupIds } })
        .populate('paidBy', 'fullName photoURL')
        .sort({ createdAt: -1 })
        .limit(15),
      Settlement.find({ group: { $in: groupIds } })
        .populate('payer', 'fullName photoURL')
        .populate('receiver', 'fullName photoURL')
        .sort({ createdAt: -1 })
        .limit(15),
    ]);

    const expenseEvents = expenses.map((e) => ({
      id: e._id.toString(),
      type: 'expense',
      text: `${e.paidBy?.fullName || 'Someone'} added "${e.description}"`,
      amount: e.totalAmount,
      groupName: groupNameById[e.group.toString()],
      createdAt: e.createdAt,
      photoURL: e.paidBy?.photoURL || null,
    }));

    const settlementEvents = settlements.map((s) => ({
      id: s._id.toString(),
      type: 'settlement',
      text: `${s.payer?.fullName || 'Someone'} paid ${s.receiver?.fullName || 'someone'}`,
      amount: s.amount,
      groupName: groupNameById[s.group.toString()],
      createdAt: s.createdAt,
      photoURL: s.payer?.photoURL || null,
      receiverPhotoURL: s.receiver?.photoURL || null,
    }));

    // Merge both event types and re-sort by time, then cap to the 15 most
    // recent overall — each source was already capped individually, but
    // merging two sorted lists of 15 needs a final re-sort + trim.
    const combined = [...expenseEvents, ...settlementEvents]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 15);

    res.status(200).json(combined);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while fetching activity.' });
  }
});

module.exports = router;