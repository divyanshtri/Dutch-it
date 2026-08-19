const { z } = require('zod');
const { objectId, nonNegativeAmount } = require('./common');

const lineItemSchema = z.object({
  itemName: z.string().trim().min(1).max(120),
  price: nonNegativeAmount,
  quantity: z.number().int().min(1).max(999).optional().default(1),
  dietaryTag: z.enum(['veg', 'non-veg', 'neutral']),
  isAlcohol: z.boolean(),
});

const splitEntrySchema = z.object({
  user: objectId,
  amount: nonNegativeAmount,
  percentage: z.number().min(0).max(100).optional(),
});

const createExpenseSchema = z.discriminatedUnion('splitType', [
  z.object({
    splitType: z.literal('itemized'),
    group: objectId,
    description: z.string().trim().min(1).max(200),
    totalAmount: nonNegativeAmount,
    paidBy: objectId,
    lineItems: z.array(lineItemSchema).min(1),
    vegMembers: z.array(objectId).default([]),
    nonVegMembers: z.array(objectId).default([]),
    alcoholMembers: z.array(objectId).default([]),
  }),
  z.object({
    splitType: z.enum(['equally', 'unequally', 'percentage']),
    group: objectId,
    description: z.string().trim().min(1).max(200),
    totalAmount: nonNegativeAmount,
    paidBy: objectId,
    splits: z.array(splitEntrySchema).min(1),
  }),
]);

module.exports = { createExpenseSchema };