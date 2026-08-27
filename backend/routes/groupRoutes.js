const express = require('express');
const router = express.Router();

const Group = require('../models/Group');
const User = require('../models/User');
const Expense = require('../models/Expense');
const Settlement = require('../models/Settlement');
const calculateSplit = require('../utils/splitCalculator');
const protect = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { actionLimiter } = require('../middleware/rateLimiters');
const {
  createGroupSchema,
  addMemberSchema,
  groupIdParamSchema,
  createGhostSchema,
} = require('../validators/groupSchemas');

// Protect all group routes
router.use(protect);

// ===== GET /api/groups - Fetch ONLY groups the logged-in user belongs to =====
router.get('/', async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user._id }).populate(
      'members',
      'fullName email phoneNumber photoURL isGhost'
    );
    res.status(200).json(groups);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while fetching groups.' });
  }
});

// ===== POST /api/groups - Create a new group =====
router.post('/', actionLimiter, validate(createGroupSchema), async (req, res) => {
  try {
    const { name, members = [] } = req.body;

    const createdBy = req.user._id;
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
router.get('/:id', validate(groupIdParamSchema, 'params'), async (req, res) => {
  try {
    const { id } = req.params;
    const group = await Group.findById(id)
      .populate('members', 'fullName email phoneNumber photoURL isGhost')
      .populate('createdBy', 'fullName email photoURL');

    if (!group) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    res.status(200).json(group);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while fetching group.' });
  }
});

// ===== DELETE /api/groups/:id - Delete a group =====
router.delete('/:id', actionLimiter, validate(groupIdParamSchema, 'params'), async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    if (group.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the group creator can delete this group.' });
    }

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
router.post(
  '/:id/members',
  actionLimiter,
  validate(groupIdParamSchema, 'params'),
  validate(addMemberSchema),
  async (req, res) => {
    try {
      const { userId } = req.body;

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
        .populate('members', 'fullName email phoneNumber photoURL isGhost')
        .populate('createdBy', 'fullName email photoURL');

      res.status(200).json(updatedGroup);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error while adding member.' });
    }
  }
);

// ===== POST /api/groups/:id/ghost-member - Create and attach an unregistered member =====
router.post(
  '/:id/ghost-member',
  actionLimiter,
  validate(groupIdParamSchema, 'params'),
  validate(createGhostSchema),
  async (req, res, next) => {
    try {
      const group = await Group.findById(req.params.id);
      if (!group) return res.status(404).json({ message: 'Group not found.' });
      if (group.createdBy.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Only the group creator can add guest members.' });
      }

      const email = req.body.email ? req.body.email.toLowerCase() : undefined;
      const phoneNumber = req.body.phone || undefined;
      const identifiers = [email && { email }, phoneNumber && { phoneNumber }].filter(Boolean);
      if (identifiers.length) {
        const existing = await User.findOne({ $or: identifiers });
        if (existing) {
          return res.status(409).json({
            message: existing.isGhost
              ? 'A guest with this contact information already exists.'
              : 'A registered account already uses this contact information. Add them as a regular member.',
          });
        }
      }

      const ghost = await User.create({
        fullName: req.body.name,
        email,
        phoneNumber,
        isGhost: true,
        createdById: req.user._id,
      });
      group.members.push(ghost._id);
      await group.save();

      return res.status(201).json({
        member: {
          _id: ghost._id,
          fullName: ghost.fullName,
          email: ghost.email,
          phoneNumber: ghost.phoneNumber,
          photoURL: ghost.photoURL,
          isGhost: true,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

// ===== POST /api/groups/:id/share - Get or lazily create a public summary token =====
router.post('/:id/share', actionLimiter, validate(groupIdParamSchema, 'params'), async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found.' });
    if (!group.members.some((id) => id.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'You are not a member of this group.' });
    }
    if (!group.shareToken) {
      group.shareToken = require('crypto').randomUUID();
      await group.save();
    }
    return res.status(200).json({ shareToken: group.shareToken });
  } catch (error) {
    return next(error);
  }
});

// ===== GET /api/groups/:id/balances - Cumulative net balances =====
router.get('/:id/balances', validate(groupIdParamSchema, 'params'), async (req, res) => {
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
      const payerId = expense.paidBy.toString();

      if (expense.splitType && expense.splitType !== 'itemized') {
        expense.splits.forEach((s) => {
          const userId = s.user.toString();
          if (userId === payerId) return;
          addDebt(userId, payerId, s.amount);
        });
        return;
      }

      const { balances } = calculateSplit(
        expense.lineItems,
        expense.vegMembers,
        expense.nonVegMembers,
        expense.alcoholMembers
      );

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
