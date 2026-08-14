const express = require('express');
const router = express.Router();

const { register, login, logout, getMe, updateMe } = require('../controllers/authController');

const protect = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', protect, getMe); // `protect` runs first, THEN getMe — order matters
router.patch('/me', protect, updateMe);

module.exports = router;