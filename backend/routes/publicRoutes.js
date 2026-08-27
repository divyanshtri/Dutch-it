const express = require('express');
const router = express.Router();
const Group = require('../models/Group');
const Expense = require('../models/Expense');
const Settlement = require('../models/Settlement');
const calculateGroupBalances = require('../utils/groupLedger');
const { publicShareLimiter } = require('../middleware/rateLimiters');

router.get('/summary/:shareToken', publicShareLimiter, async (req, res, next) => {
  try {
    let sharedExpense = null;
    let group = await Group.findOne({ shareToken: req.params.shareToken })
      .select('name members shareToken createdAt')
      .populate('members', 'fullName photoURL isGhost');
    if (!group) {
      sharedExpense = await Expense.findOne({ shareToken: req.params.shareToken }).select('group');
      if (sharedExpense) {
        group = await Group.findById(sharedExpense.group)
          .select('name members createdAt')
          .populate('members', 'fullName photoURL isGhost');
      }
    }
    if (!group) return res.status(404).json({ message: 'Shared summary not found.' });

    const [expenses, settlements] = await Promise.all([
      Expense.find(sharedExpense ? { _id: sharedExpense._id } : { group: group._id })
        .select('description totalAmount paidBy splitType splits lineItems vegMembers nonVegMembers alcoholMembers createdAt')
        .populate('paidBy', 'fullName isGhost')
        .sort({ createdAt: -1 }),
      Settlement.find(sharedExpense ? { _id: null } : { group: group._id }).select('payer receiver amount createdAt'),
    ]);

    const balances = calculateGroupBalances(expenses, settlements);
    const total = expenses.reduce((sum, expense) => sum + expense.totalAmount, 0);
    res.status(200).json({
      scope: sharedExpense ? 'expense' : 'group',
      group: { name: group.name, shareToken: req.params.shareToken, members: group.members },
      total: Math.round(total * 100) / 100,
      balances,
      expenses: expenses.map((expense) => ({
        _id: expense._id,
        description: expense.description,
        totalAmount: expense.totalAmount,
        paidBy: expense.paidBy,
        splitType: expense.splitType,
        splits: expense.splits,
        lineItems: expense.lineItems,
        createdAt: expense.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
