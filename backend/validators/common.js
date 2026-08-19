const { z } = require('zod');

// Validates 24-character hexadecimal MongoDB ObjectIDs
const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format.');

// Validates currency amounts (non-negative and capped at 10 million)
const nonNegativeAmount = z.number().nonnegative('Amount cannot be negative.').max(10_000_000);

module.exports = { objectId, nonNegativeAmount };