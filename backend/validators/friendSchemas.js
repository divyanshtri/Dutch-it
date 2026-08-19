const { z } = require('zod');
const { objectId } = require('./common');

const addFriendSchema = z.object({
  identifier: z.string().trim().min(3).max(254),
});

const friendIdParamSchema = z.object({ friendId: objectId });

module.exports = { addFriendSchema, friendIdParamSchema };