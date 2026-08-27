const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const mergeGhostUser = require('../utils/mergeGhostUser');

// ----- PASSWORD STRENGTH VALIDATION -----
function isPasswordStrong(password) {
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);
  return hasMinLength && hasLetter && hasNumber && hasSymbol;
}

// ----- SHARED COOKIE OPTIONS -----
// Updated sameSite to 'none' in production to allow cross-site cookie transmission (Render <-> Vercel)
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days, in milliseconds
};

// ===== POST /api/auth/register =====
async function register(req, res, next) {
  try {
    const { fullName, email, phoneNumber, password, isVegetarian, drinksAlcohol, photoURL } = req.body;

    if (!fullName || !email || !phoneNumber || !password) {
      return res.status(400).json({ message: 'Full name, email, phone number, and password are all required.' });
    }

    if (!isPasswordStrong(password)) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters and include a letter, a number, and a symbol.',
      });
    }

    const existingUsers = await User.find({
      $or: [{ email: email.toLowerCase() }, { phoneNumber }],
    });

    const registeredConflict = existingUsers.find((candidate) => !candidate.isGhost);
    if (registeredConflict) {
      const conflictField = registeredConflict.email === email.toLowerCase() ? 'email' : 'phone number';
      return res.status(409).json({ message: `An account with this ${conflictField} already exists.` });
    }

    if (existingUsers.length > 1) {
      return res.status(409).json({ message: 'Your email and phone match different guest profiles. Please contact support to merge them.' });
    }

    const newUser = existingUsers[0] || new User();
    Object.assign(newUser, {
      fullName, email: email.toLowerCase(), phoneNumber, password,
      isVegetarian, drinksAlcohol, photoURL: photoURL || null,
      isGhost: false, createdById: null,
    });

    const savedUser = await newUser.save();

    const token = generateToken(savedUser._id);
    res.cookie('token', token, cookieOptions);

    res.status(201).json({
      user: {
        _id: savedUser._id,
        fullName: savedUser.fullName,
        email: savedUser.email,
        phoneNumber: savedUser.phoneNumber,
        isVegetarian: savedUser.isVegetarian,
        drinksAlcohol: savedUser.drinksAlcohol,
        photoURL: savedUser.photoURL,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'An account with this email or phone number already exists.' });
    }
    next(error);
  }
}

// ===== POST /api/auth/login =====
async function login(req, res, next) {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Email/phone and password are required.' });
    }

    const user = await User.findOne({
      $or: [{ email: identifier.toLowerCase() }, { phoneNumber: identifier }],
    }).select('+password');

    const isMatch = user
      ? await user.comparePassword(password)
      : await require('bcryptjs').compare(password, '$2a$12$invalidsaltinvalidsaltinvalidsalt');

    if (!user || !isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const token = generateToken(user._id);
    res.cookie('token', token, cookieOptions);

    res.status(200).json({
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        isVegetarian: user.isVegetarian,
        drinksAlcohol: user.drinksAlcohol,
        photoURL: user.photoURL,
      },
    });
  } catch (error) {
    next(error);
  }
}

// ===== POST /api/auth/logout =====
function logout(req, res) {
  res.clearCookie('token', {
    httpOnly: cookieOptions.httpOnly,
    secure: cookieOptions.secure,
    sameSite: cookieOptions.sameSite,
  });
  res.status(200).json({ message: 'Logged out successfully.' });
}

// ===== GET /api/auth/me =====
function getMe(req, res) {
  res.status(200).json({ user: req.user });
}

// ===== PATCH /api/auth/me =====
async function updateMe(req, res, next) {
  try {
    const { fullName, photoURL, email, phoneNumber } = req.body;
    const updates = {};

    if (fullName !== undefined) {
      if (!fullName.trim()) return res.status(400).json({ message: 'Name cannot be empty.' });
      updates.fullName = fullName.trim();
    }

    if (email !== undefined) {
      const normalizedEmail = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(400).json({ message: 'Please provide a valid email address.' });
      }
      const matchingUser = await User.findOne({ email: normalizedEmail, _id: { $ne: req.user._id } });
      if (matchingUser && !matchingUser.isGhost) return res.status(409).json({ message: 'That email is already in use.' });
      if (matchingUser?.isGhost) await mergeGhostUser(matchingUser._id, req.user._id);
      updates.email = normalizedEmail;
    }

    if (phoneNumber !== undefined) {
      const normalizedPhone = phoneNumber.trim();
      if (!/^\+?[0-9]{7,15}$/.test(normalizedPhone)) {
        return res.status(400).json({ message: 'Please provide a valid phone number.' });
      }
      const matchingUser = await User.findOne({ phoneNumber: normalizedPhone, _id: { $ne: req.user._id } });
      if (matchingUser && !matchingUser.isGhost) return res.status(409).json({ message: 'That phone number is already in use.' });
      if (matchingUser?.isGhost) await mergeGhostUser(matchingUser._id, req.user._id);
      updates.phoneNumber = normalizedPhone;
    }

    if (photoURL !== undefined && photoURL !== null) {
      if (!/^data:image\/(jpeg|png|webp);base64,/.test(photoURL)) {
        return res.status(400).json({ message: 'Invalid image format.' });
      }
      if (photoURL.length > 3 * 1024 * 1024) {
        return res.status(400).json({ message: 'Image too large.' });
      }
      updates.photoURL = photoURL;
    } else if (photoURL === null) {
      updates.photoURL = null;
    }

    const updatedUser = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });
    res.status(200).json({ user: updatedUser });
  } catch (error) {
    next(error);
  }
}

module.exports = { register, login, logout, getMe, updateMe };
