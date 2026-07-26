const express = require('express');
const router = express.Router();

const Group = require('../models/Group');
const User = require('../models/User');
const Expense = require('../models/Expense');
const Settlement = require('../models/Settlement');
const calculateSplit = require('../utils/splitCalculator');
const protect = require('../middleware/authMiddleware');

// Protect all group routes
router.use(protect);

// ===== GET /api/groups - Fetch ONLY groups the logged-in user belongs to =====
router.get('/', async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user._id }).populate('members', 'fullName email');
    res.status(200).json(groups);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while fetching groups.' });
  }
});

// ===== POST /api/groups - Create a new group =====
router.post('/', async (req, res) => {
  try {
    const { name, members = [] } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Group name is required.' });
    }

    // Trust req.user._id for createdBy (never trust req.body for creator ID)
    const createdBy = req.user._id;

    // Ensure creator is included in the members list
    const memberSet = new Set([...members.map(String), createdBy.toString()]);
    const finalMembers = [...memberSet];

    if (finalMembers.length > 0) {
      const foundUsers = await User.find({ _id: { $in: finalMembers } });
      if (foundUsers.length !== finalMembers.length) {
        return res.status(400).json({ message: 'One or more member IDs are invalid.' });
      }
    }

    const newGroup = new Group({ name, members: finalMembers, createdBy });
    const savedGroup = await newGroup.save();

    res.status(201).json(savedGroup);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while creating group.' });
  }
});

// ===== GET /api/groups/:id - Single group details =====
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const group = await Group.findById(id)
      .populate('members', 'fullName email name')
      .populate('createdBy', 'fullName email');

    if (!group) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    res.status(200).json(group);
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid group ID format.' });
    }
    console.error(error);
    res.status(500).json({ message: 'Server error while fetching group.' });
  }
});

// ===== DELETE /api/groups/:id - Delete a group =====
router.delete('/:id', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    // Only the creator can delete — prevents any member from wiping the group for everyone else.
    if (group.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the group creator can delete this group.' });
    }

    // Clean up dependent data so orphaned expenses/settlements don't linger
    await Promise.all([
      Expense.deleteMany({ group: req.params.id }),
      Settlement.deleteMany({ group: req.params.id }),
      Group.findByIdAndDelete(req.params.id),
    ]);

    res.status(200).json({ message: 'Group deleted successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while deleting group.' });
  }
});

// ===== POST /api/groups/:id/members - Add a member to an existing group =====
router.post('/:id/members', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ message: 'userId is required.' });
    }

    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    const userExists = await User.findById(userId);
    if (!userExists) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const alreadyMember = group.members.some((id) => id.toString() === userId);
    if (alreadyMember) {
      return res.status(409).json({ message: 'This user is already a member.' });
    }

    group.members.push(userId);
    await group.save();

    const updatedGroup = await Group.findById(req.params.id)
      .populate('members', 'fullName email name')
      .populate('createdBy', 'fullName email');

    res.status(200).json(updatedGroup);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while adding member.' });
  }
});

// ===== GET /api/groups/:id/balances - Cumulative net balances =====
router.get('/:id/balances', async (req, res) => {
  try {
    const groupId = req.params.id;
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    const [expenses, settlements] = await Promise.all([
      Expense.find({ group: groupId }),
      Settlement.find({ group: groupId }),
    ]);

    const ledger = {};

    function addDebt(debtorId, creditorId, amount) {
      if (!ledger[debtorId]) ledger[debtorId] = {};
      if (!ledger[debtorId][creditorId]) ledger[debtorId][creditorId] = 0;
      ledger[debtorId][creditorId] += amount;
    }

    expenses.forEach((expense) => {
      const { balances } = calculateSplit(
        expense.lineItems,
        expense.vegMembers,
        expense.nonVegMembers,
        expense.alcoholMembers
      );

      const payerId = expense.paidBy.toString();

      Object.keys(balances).forEach((userId) => {
        if (userId === payerId) return;
        addDebt(userId, payerId, balances[userId]);
      });
    });

    settlements.forEach((settlement) => {
      const payerId = settlement.payer.toString();
      const receiverId = settlement.receiver.toString();
      addDebt(payerId, receiverId, -settlement.amount);
    });

    const simplifiedDebts = [];
    const processedPairs = new Set();

    Object.keys(ledger).forEach((debtorId) => {
      Object.keys(ledger[debtorId]).forEach((creditorId) => {
        const pairKey = [debtorId, creditorId].sort().join('_');
        if (processedPairs.has(pairKey)) return;
        processedPairs.add(pairKey);

        const amountAOwesB = ledger[debtorId]?.[creditorId] || 0;
        const amountBOwesA = ledger[creditorId]?.[debtorId] || 0;
        const netAmount = amountAOwesB - amountBOwesA;

        if (Math.abs(netAmount) < 0.01) return;

        if (netAmount > 0) {
          simplifiedDebts.push({
            owes: debtorId,
            owedTo: creditorId,
            amount: Math.round(netAmount * 100) / 100,
          });
        } else {
          simplifiedDebts.push({
            owes: creditorId,
            owedTo: debtorId,
            amount: Math.round(Math.abs(netAmount) * 100) / 100,
          });
        }
      });
    });

    res.status(200).json({
      group: group.name,
      balances: simplifiedDebts,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while calculating group balances.' });
  }
});

module.exports = router;