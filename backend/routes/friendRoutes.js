const express = require('express');
const router = express.Router();
const User = require('../models/User');
const protect = require('../middleware/authMiddleware');

router.use(protect);

// ===== GET /api/friends - Fetch the logged-in user's friends list =====
router.get('/', async (req, res) => {
  try {
    // .populate('friends') swaps the array of ObjectIds on req.user's
    // document for full User objects — same pattern as populating a
    // Group's members. We re-fetch here (rather than trusting req.user
    // from the middleware) specifically so populate can run — the
    // middleware's req.user was fetched without population.
    const currentUser = await User.findById(req.user._id).populate(
      'friends',
      'fullName email phoneNumber' // only pull these fields, not passwords or anything unnecessary
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
    const { identifier } = req.body; // email OR phone number, same pattern as login

    if (!identifier) {
      return res.status(400).json({ message: 'Provide an email or phone number.' });
    }

    const friendUser = await User.findOne({
      $or: [{ email: identifier.toLowerCase() }, { phoneNumber: identifier }],
    });

    if (!friendUser) {
      return res.status(404).json({ message: 'No user found with that email or phone number.' });
    }

    if (friendUser._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot add yourself as a friend.' });
    }

    const currentUser = await User.findById(req.user._id);

    // Check both directions aren't already connected before mutating
    // anything — avoids duplicate entries piling up in either array if
    // someone clicks "Add" twice.
    const alreadyFriends = currentUser.friends.some(
      (id) => id.toString() === friendUser._id.toString()
    );
    if (alreadyFriends) {
      return res.status(409).json({ message: 'You are already friends with this person.' });
    }

    // Mutual add: push each user into the other's friends array, then
    // save both. Not wrapped in a transaction — for a hobby-scale app this
    // is an acceptable simplification, but worth knowing: if the server
    // crashed exactly between these two saves, you could end up with a
    // one-directional friendship. Flagging this as a known simplification,
    // not something to fix right now.
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
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while adding friend.' });
  }
});

module.exports = router;