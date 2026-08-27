const express = require('express');
const router = express.Router();

const User = require('../models/User');
const protect = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { actionLimiter } = require('../middleware/rateLimiters');
const { addFriendSchema, friendIdParamSchema } = require('../validators/friendSchemas');

router.use(protect);

function normalizePhone(input) {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return input.startsWith('+') ? input : `+${digits}`;
}

// ===== GET /api/friends - Fetch the logged-in user's friends list =====
router.get('/', async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id).populate(
      'friends',
      'fullName email phoneNumber photoURL isGhost'
    );

    res.status(200).json(currentUser.friends);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while fetching friends.' });
  }
});

// ===== POST /api/friends/add - Add a friend by email or phone =====
router.post('/add', actionLimiter, validate(addFriendSchema), async (req, res) => {
  try {
    const { identifier } = req.body;

    const isEmail = identifier.includes('@');
    const query = isEmail
      ? { email: identifier.toLowerCase() }
      : { $or: [{ phoneNumber: identifier }, { phoneNumber: normalizePhone(identifier) }] };

    const friendUser = await User.findOne(query);

    if (!friendUser) {
      return res.status(404).json({ message: 'No user found with that email or phone number.' });
    }

    if (friendUser._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot add yourself as a friend.' });
    }

    const currentUser = await User.findById(req.user._id);

    const alreadyFriends = currentUser.friends.some(
      (id) => id.toString() === friendUser._id.toString()
    );
    if (alreadyFriends) {
      return res.status(409).json({ message: 'You are already friends with this person.' });
    }

    currentUser.friends.push(friendUser._id);
    friendUser.friends.push(currentUser._id);

    await Promise.all([currentUser.save(), friendUser.save()]);

    res.status(201).json({
      message: `${friendUser.fullName} added as a friend.`,
      friend: {
        _id: friendUser._id,
        fullName: friendUser.fullName,
        email: friendUser.email,
        phoneNumber: friendUser.phoneNumber,
        photoURL: friendUser.photoURL,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while adding friend.' });
  }
});

// ===== DELETE /api/friends/:friendId - Remove a mutual friendship =====
router.delete('/:friendId', actionLimiter, validate(friendIdParamSchema, 'params'), async (req, res) => {
  try {
    const { friendId } = req.params;
    const currentUser = await User.findById(req.user._id);
    const friendUser = await User.findById(friendId);

    if (!friendUser) return res.status(404).json({ message: 'User not found.' });

    currentUser.friends = currentUser.friends.filter((id) => id.toString() !== friendId);
    friendUser.friends = friendUser.friends.filter((id) => id.toString() !== req.user._id.toString());

    await Promise.all([currentUser.save(), friendUser.save()]);

    res.status(200).json({ message: 'Friend removed.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while removing friend.' });
  }
});

module.exports = router;
