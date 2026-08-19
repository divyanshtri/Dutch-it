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

module.exports = { createGroupSchema, addMemberSchema, groupIdParamSchema };