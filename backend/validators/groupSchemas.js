const { z } = require('zod');
const { objectId } = require('./common');

const createGroupSchema = z.object({
  name: z.string().trim().min(1, 'Group name is required.').max(80),
  members: z.array(objectId).max(50).optional(),
});

const addMemberSchema = z.object({
  userId: objectId,
});

const groupIdParamSchema = z.object({ id: objectId });

const createGhostSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(100),
  phone: z.string().trim().regex(/^\+?[0-9]{7,15}$/, 'Enter a valid phone number.').optional().or(z.literal('')),
  email: z.string().trim().email('Enter a valid email.').optional().or(z.literal('')),
});

module.exports = { createGroupSchema, addMemberSchema, groupIdParamSchema, createGhostSchema };
