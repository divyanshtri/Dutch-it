const express = require('express');
const router = express.Router();

const { register, login, logout, getMe, updateMe } = require('../controllers/authController');
const protect = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { registerSchema, loginSchema } = require('../validators/authSchemas');

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/logout', logout);
router.get('/me', protect, getMe);
router.patch('/me', protect, updateMe);

module.exports = router;