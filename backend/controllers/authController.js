const User = require('../models/User');
const generateToken = require('../utils/generateToken');

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

    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phoneNumber }],
    });

    if (existingUser) {
      const conflictField = existingUser.email === email.toLowerCase() ? 'email' : 'phone number';
      return res.status(409).json({ message: `An account with this ${conflictField} already exists.` });
    }

    const newUser = new User({
      fullName,
      email: email.toLowerCase(),
      phoneNumber,
      password,
      isVegetarian,
      drinksAlcohol,
      photoURL: photoURL || null,
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
    const { fullName, photoURL } = req.body;
    const updates = {};

    if (fullName !== undefined) {
      if (!fullName.trim()) return res.status(400).json({ message: 'Name cannot be empty.' });
      updates.fullName = fullName.trim();
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