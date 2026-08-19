const express = require('express');
const router = express.Router();

const Expense = require('../models/Expense');
const Group = require('../models/Group');
const calculateSplit = require('../utils/splitCalculator');
const protect = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { actionLimiter } = require('../middleware/rateLimiters');
const { createExpenseSchema } = require('../validators/expenseSchemas');

router.use(protect);

// ===== GET /api/expenses - fetch all expenses =====
router.get('/', async (req, res) => {
  try {
    const expenses = await Expense.find({});
    res.status(200).json(expenses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while fetching expenses.' });
  }
});

// ===== POST /api/expenses - create a new expense =====
router.post('/', actionLimiter, validate(createExpenseSchema), async (req, res) => {
  try {
    const { group, description, totalAmount, paidBy, splitType = 'itemized' } = req.body;

    const groupExists = await Group.findById(group);
    if (!groupExists) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    // ----- NON-ITEMIZED PATH (equally, unequally, percentage) -----
    if (splitType !== 'itemized') {
      const { splits } = req.body;

      const sum = splits.reduce((s, x) => s + (x.amount || 0), 0);
      if (Math.abs(sum - totalAmount) > 0.5) {
        return res.status(400).json({
          message: `Split amounts (₹${sum.toFixed(2)}) don't add up to the total (₹${totalAmount}).`,
        });
      }

      if (splitType === 'percentage') {
        const pctSum = splits.reduce((s, x) => s + (x.percentage || 0), 0);
        if (Math.abs(pctSum - 100) > 0.5) {
          return res.status(400).json({
            message: `Percentages sum to ${pctSum.toFixed(1)}%, not 100%.`,
          });
        }
      }

      const newExpense = new Expense({
        group,
        description,
        totalAmount,
        paidBy,
        splitType,
        splits,
      });

      const savedExpense = await newExpense.save();

      const settlement = splits
        .filter((s) => s.user.toString() !== paidBy.toString())
        .map((s) => ({
          userId: s.user,
          theirShareOfBill: s.amount,
          amountTheyOwe: s.amount,
          owesTo: paidBy,
        }));

      return res.status(201).json({ expense: savedExpense, settlement });
    }

    // ----- ITEMIZED PATH -----
    const {
      lineItems,
      vegMembers = [],
      nonVegMembers = [],
      alcoholMembers = [],
    } = req.body;

    const { balances, allMembers } = calculateSplit(
      lineItems,
      vegMembers,
      nonVegMembers,
      alcoholMembers
    );

    const newExpense = new Expense({
      group,
      description,
      totalAmount,
      paidBy,
      lineItems,
      vegMembers,
      nonVegMembers,
      alcoholMembers,
      splitType: 'itemized',
    });

    const savedExpense = await newExpense.save();

    const settlement = allMembers.map((userId) => {
      const isPayer = userId.toString() === paidBy.toString();
      return {
        userId,
        theirShareOfBill: balances[userId],
        ...(isPayer
          ? { amountOwedToThem: Math.round((totalAmount - balances[userId]) * 100) / 100 }
          : { amountTheyOwe: balances[userId], owesTo: paidBy }),
      };
    });

    return res.status(201).json({ expense: savedExpense, settlement });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    console.error(error);
    return res.status(500).json({ message: 'Server error while creating expense.' });
  }
});

module.exports = router;