const express = require('express');
const router = express.Router();

const Group = require('../models/Group');
const User = require('../models/User');

const Expense = require('../models/Expense');
const Settlement = require('../models/Settlement');
const calculateSplit = require('../utils/splitCalculator');

router.post('/', async (req, res) => {
  try {
    const { name, members, createdBy } = req.body;


    if (!name || !createdBy) {
      return res.status(400).json({ message: 'Group name and createdBy are required.' });
    }

    // ----- VALIDATING THE RELATIONSHIP -----
    // Mongoose will happily save an ObjectId even if it doesn't point to a real user
    // (it doesn't check this automatically). So we manually verify that every ID
    // in `members` actually exists in the User collection before creating the group.
    // This prevents "orphaned references" — IDs that point to nothing.
    if (members && members.length > 0) {
      const foundUsers = await User.find({ _id: { $in: members } });
      // $in means "match any document whose _id is in this array"

      if (foundUsers.length !== members.length) {
        return res.status(400).json({ message: 'One or more member IDs are invalid.' });
      }
    }

    const newGroup = new Group({
      name,
      members, // Mongoose automatically casts these ID strings into ObjectId type
      createdBy,
    });

    const savedGroup = await newGroup.save();

    res.status(201).json(savedGroup);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while creating group.' });
  }
});

// ===== GET /api/groups - Fetch all groups =====
// Just like GET /api/users, an empty filter object {} means "match everything"
// in the groups collection. This is what your GroupsList component's
// fetch('http://localhost:5000/api/groups') is actually hitting.
router.get('/', async (req, res) => {
  try {
    // We populate 'members' here too, so the frontend gets full user objects
    // (with names) instead of bare ObjectId strings — useful since your
    // GroupsList card shows "3 members" now, but you'll likely want to show
    // member NAMES on this list later too.
    const groups = await Group.find({}).populate('members');

    res.status(200).json(groups);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while fetching groups.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const groupId = req.params.id;

 
    const group = await Group.findById(groupId)
      .populate('members')   // swaps member ObjectIds -> full User documents
      .populate('createdBy'); // does the same for the single createdBy reference

    if (!group) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    res.status(200).json(group);

  } catch (error) {
    // A malformed ID (e.g., "abc123" instead of a real 24-character ObjectId)
    // will throw a CastError here rather than just returning null.
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid group ID format.' });
    }

    console.error(error);
    res.status(500).json({ message: 'Server error while fetching group.' });
  }
});

// ===== GET /api/groups/:id/balances - Cumulative net balances for the group =====
router.get('/:id/balances', async (req, res) => {
  try {
    const groupId = req.params.id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    // Fetch every expense AND every settlement ever recorded for this group.
    // Promise.all() again, since these two queries don't depend on each other.
    const [expenses, settlements] = await Promise.all([
      Expense.find({ group: groupId }),
      Settlement.find({ group: groupId }),
    ]);

    // ----- THE LEDGER -----
    // This is a "nested object" acting as a 2D lookup table:
    //   ledger[debtorId][creditorId] = amount that debtor owes creditor
    //
    // Why not just one flat "balances" object like in calculateSplit? Because
    // with MULTIPLE bills paid by DIFFERENT people, debts exist between
    // specific PAIRS of people, not just "everyone vs one payer" like a single
    // bill. Rohan might owe Priya ₹300 from one dinner, while ALSO being owed
    // ₹100 by Aman from a different dinner Rohan paid for. We need to track
    // each pair separately before we can net anything out.
    const ledger = {};

    // Small helper: safely adds `amount` to ledger[debtor][creditor],
    // creating the nested objects if they don't exist yet.
    function addDebt(debtorId, creditorId, amount) {
      if (!ledger[debtorId]) ledger[debtorId] = {};
      if (!ledger[debtorId][creditorId]) ledger[debtorId][creditorId] = 0;
      ledger[debtorId][creditorId] += amount;
    }

    // ----- STEP 1: Replay every expense, adding debts to the ledger -----
    // .forEach() because we're just accumulating into `ledger` — no new array needed.
    expenses.forEach((expense) => {
      // Recompute this bill's split using the SAME arrays we saved on the
      // Expense document at creation time. This is exactly why we needed to
      // persist vegMembers/nonVegMembers/alcoholMembers in step 2 above —
      // without them, we couldn't redo this math for historical bills.
      const { balances } = calculateSplit(
        expense.lineItems,
        expense.vegMembers,
        expense.nonVegMembers,
        expense.alcoholMembers
      );

      const payerId = expense.paidBy.toString();
      // .toString() matters here: Mongoose ObjectIds are objects, not strings,
      // so comparing them with === or using them as object keys can behave
      // unexpectedly unless we explicitly convert to string first.

      Object.keys(balances).forEach((userId) => {
        if (userId === payerId) return; // the payer doesn't owe themself anything

        // This user's share of THIS bill becomes a debt owed to whoever paid it.
        addDebt(userId, payerId, balances[userId]);
      });
    });

    // ----- STEP 2: Replay every settlement, subtracting debts from the ledger -----
    // A settlement means "payer already gave receiver this amount," so it should
    // REDUCE however much the payer owes the receiver — a negative addDebt, essentially.
    settlements.forEach((settlement) => {
      const payerId = settlement.payer.toString();
      const receiverId = settlement.receiver.toString();

      // Subtracting is just adding a negative amount using the same helper.
      addDebt(payerId, receiverId, -settlement.amount);
    });

    // ----- STEP 3: Simplify the ledger -----
    // After steps 1-2, it's possible ledger[Rohan][Priya] = 200 AND
    // ledger[Priya][Rohan] = 50 both exist at once (e.g., Rohan owes Priya
    // from one bill, Priya owes Rohan from a different bill). That's technically
    // correct but confusing to display — nobody wants to see "you owe them ₹200
    // AND they owe you ₹50" when the real answer is just "you owe them ₹150."
    //
    // We net every pair down to a single direction here.
    const simplifiedDebts = []; // final output: a clean list of one-directional debts

    // Object.keys(ledger) gives us every debtor who owes SOMEBODY something.
    const processedPairs = new Set();
    // We track which pairs we've already handled so we don't process
    // the same Rohan<->Priya pair twice (once from each side).

    Object.keys(ledger).forEach((debtorId) => {
      Object.keys(ledger[debtorId]).forEach((creditorId) => {
        const pairKey = [debtorId, creditorId].sort().join('_');
        // .sort() ensures "Rohan_Priya" and "Priya_Rohan" produce the SAME
        // key, regardless of which direction we encounter the pair in first.

        if (processedPairs.has(pairKey)) return; // already handled this pair
        processedPairs.add(pairKey);

        const amountAOwesB = ledger[debtorId]?.[creditorId] || 0;
        const amountBOwesA = ledger[creditorId]?.[debtorId] || 0;

        const netAmount = amountAOwesB - amountBOwesA;

        if (Math.abs(netAmount) < 0.01) return; // effectively settled — skip (avoids -0.00 noise)

        if (netAmount > 0) {
          // debtorId still owes creditorId, net of everything
          simplifiedDebts.push({
            owes: debtorId,
            owedTo: creditorId,
            amount: Math.round(netAmount * 100) / 100,
          });
        } else {
          // the direction actually flips the other way
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