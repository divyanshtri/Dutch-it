const mongoose = require('mongoose');
const User = require('../models/User');
const Group = require('../models/Group');
const Expense = require('../models/Expense');
const Settlement = require('../models/Settlement');
const Nudge = require('../models/Nudge');

async function mergeGhostUser(ghostUserId, userId) {
  const ghostId = new mongoose.Types.ObjectId(ghostUserId);
  const realId = new mongoose.Types.ObjectId(userId);
  if (ghostId.equals(realId)) return;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const ghost = await User.findOne({ _id: ghostId, isGhost: true }).session(session);
      if (!ghost) throw Object.assign(new Error('Guest profile not found.'), { statusCode: 404 });

      await Group.updateMany({ members: ghostId }, { $addToSet: { members: realId } }, { session });
      await Group.updateMany({ members: ghostId }, { $pull: { members: ghostId } }, { session });
      await Expense.updateMany({ paidBy: ghostId }, { $set: { paidBy: realId } }, { session });
      await Expense.updateMany({ 'splits.user': ghostId }, { $set: { 'splits.$[entry].user': realId } }, {
        arrayFilters: [{ 'entry.user': ghostId }], session,
      });

      for (const field of ['vegMembers', 'nonVegMembers', 'alcoholMembers']) {
        await Expense.updateMany({ [field]: ghostId }, { $addToSet: { [field]: realId } }, { session });
        await Expense.updateMany({ [field]: ghostId }, { $pull: { [field]: ghostId } }, { session });
      }
      await Expense.updateMany(
        { 'lineItems.splitAmong': ghostId },
        { $set: { 'lineItems.$[].splitAmong.$[member]': realId } },
        { arrayFilters: [{ member: ghostId }], session }
      );
      await Settlement.updateMany({ payer: ghostId }, { $set: { payer: realId } }, { session });
      await Settlement.updateMany({ receiver: ghostId }, { $set: { receiver: realId } }, { session });
      await Nudge.updateMany({ fromUser: ghostId }, { $set: { fromUser: realId } }, { session });
      await Nudge.updateMany({ toUser: ghostId }, { $set: { toUser: realId } }, { session });
      await User.updateMany({ friends: ghostId }, { $addToSet: { friends: realId } }, { session });
      await User.updateMany({ friends: ghostId }, { $pull: { friends: ghostId } }, { session });
      await User.deleteOne({ _id: ghostId }, { session });
    });
  } finally {
    await session.endSession();
  }
}

module.exports = mergeGhostUser;
