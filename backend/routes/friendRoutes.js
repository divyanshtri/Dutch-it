const express = require('express');
const router = express.Router();
const User = require('../models/User');
const protect = require('../middleware/authMiddleware');

router.use(protect);

// Helper function to handle phone number formats automatically
function normalizePhone(input) {
  const digits = input.replace(/\D/g, ''); // strip non-digits
  if (digits.length === 10) return `+91${digits}`; // bare 10-digit -> assume +91
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return input.startsWith('+') ? input : `+${digits}`;
}

// ===== GET /api/friends - Fetch the logged-in user's friends list =====
router.get('/', async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id).populate(
      'friends',
      'fullName email phoneNumber photoURL' // include photoURL along with public info
    );

    res.status(200).json(currentUser.friends);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while fetching friends.' });
  }
});

// ===== POST /api/friends/add - Add a friend by email or phone =====
router.post('/add', async (req, res) => {
  try {
    const { identifier } = req.body; // email OR phone number

    if (!identifier) {
      return res.status(400).json({ message: 'Provide an email or phone number.' });
    }

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

    // Check both directions aren't already connected before mutating
    const alreadyFriends = currentUser.friends.some(
      (id) => id.toString() === friendUser._id.toString()
    );
    if (alreadyFriends) {
      return res.status(409).json({ message: 'You are already friends with this person.' });
    }

    // Mutual add: push each user into the other's friends array, then save both.
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
router.delete('/:friendId', async (req, res) => {
  try {
    const { friendId } = req.params;
    const currentUser = await User.findById(req.user._id);
    const friendUser = await User.findById(friendId);

    if (!friendUser) return res.status(404).json({ message: 'User not found.' });

    // Mutual remove — same symmetry as the mutual add.
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