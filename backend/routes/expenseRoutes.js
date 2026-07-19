const express = require('express');
const router = express.Router();

const Expense = require('../models/Expense');
const Group = require('../models/Group');
const calculateSplit = require('../utils/splitCalculator'); // <-- now imported, not defined here

// ===== GET /api/expenses - fetch all expenses (for debugging/testing) =====
router.get('/', async (req, res) => {
  try {
    const expenses = await Expense.find({});
    res.status(200).json(expenses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while fetching expenses.' });
  }
});


router.post('/', async (req, res) => {
  try {
    const {
      group,
      description,
      totalAmount,
      paidBy,
      lineItems,
      vegMembers = [],
      nonVegMembers = [],
      alcoholMembers = [],
    } = req.body;

    if (!group || !description || !totalAmount || !paidBy || !lineItems) {
      return res.status(400).json({
        message: 'group, description, totalAmount, paidBy, and lineItems are all required.',
      });
    }

    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      return res.status(400).json({ message: 'lineItems must be a non-empty array.' });
    }

    const groupExists = await Group.findById(group);
    if (!groupExists) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    const { balances, allMembers } = calculateSplit(
      lineItems,
      vegMembers,
      nonVegMembers,
      alcoholMembers
    );

    // IMPORTANT CHANGE: we now save vegMembers/nonVegMembers/alcoholMembers
    // alongside the raw lineItems, so this bill's split can be recomputed
    // later by the balances engine without needing the original request again.
    const newExpense = new Expense({
      group,
      description,
      totalAmount,
      paidBy,
      lineItems,
      vegMembers,
      nonVegMembers,
      alcoholMembers,
    });

    const savedExpense = await newExpense.save();

    const settlement = allMembers.map((userId) => {
      const isPayer = userId === paidBy;
      return {
        userId,
        theirShareOfBill: balances[userId],
        ...(isPayer
          ? { amountOwedToThem: Math.round((totalAmount - balances[userId]) * 100) / 100 }
          : { amountTheyOwe: balances[userId], owesTo: paidBy }),
      };
    });

    res.status(201).json({ expense: savedExpense, settlement });

  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    console.error(error);
    res.status(500).json({ message: 'Server error while creating expense.' });
  }
});

module.exports = router;