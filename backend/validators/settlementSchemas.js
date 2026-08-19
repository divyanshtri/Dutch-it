const { z } = require('zod');
const { objectId, nonNegativeAmount } = require('./common');

const createSettlementSchema = z.object({
  groupId: objectId,
  payerId: objectId,
  receiverId: objectId,
  amount: nonNegativeAmount.refine((n) => n > 0, 'Amount must be greater than 0.'),
}).refine((data) => data.payerId !== data.receiverId, {
  message: 'payerId and receiverId cannot be the same person.',
  path: ['receiverId'],
});

module.exports = { createSettlementSchema };