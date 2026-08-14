const User = require('../models/User');
const generateToken = require('../utils/generateToken');

// ----- PASSWORD STRENGTH VALIDATION -----
// At least 8 characters, one letter, one number, one symbol. Not the most
// exhaustive policy possible, but a solid, standard baseline that blocks
// the worst offenders ("password", "12345678") without being so strict
// users get frustrated.
function isPasswordStrong(password) {
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);
  return hasMinLength && hasLetter && hasNumber && hasSymbol;
}

// ----- SHARED COOKIE OPTIONS -----
// Centralized here so login/register/logout can't accidentally drift out
// of sync with each other (e.g. logout using different cookie settings
// than login used to SET the cookie would fail to actually clear it —
// cookie clearing must match path/domain/etc of the original).
const cookieOptions = {
  httpOnly: true,
  // httpOnly means JavaScript running in the browser (via document.cookie)
  // CANNOT read this cookie at all — only the browser itself sends it
  // automatically with requests. This is the core XSS defense: even if an
  // attacker injects malicious JS into your page somehow, they can't steal
  // the auth token via document.cookie, because it's simply invisible to JS.
  secure: process.env.NODE_ENV === 'production',
  // secure means the cookie is ONLY sent over HTTPS. We conditionally
  // disable this in development because localhost typically runs on plain
  // HTTP — a secure cookie would silently never be sent at all locally,
  // making login look broken. This MUST be true once actually deployed.
  sameSite: 'strict',
  // sameSite: 'strict' means the browser will NOT attach this cookie to
  // any request originating from a different site — this is the core CSRF
  // defense. Even if a malicious site tricks a logged-in user into
  // submitting a form to your API, the browser won't include their auth
  // cookie on that cross-site request, so it fails auth.
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days, in milliseconds
};

// ===== POST /api/auth/register =====
async function register(req, res) {
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

    // Check both fields for conflicts in a SINGLE query using $or, rather
    // than two separate database round-trips — a small efficiency habit.
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phoneNumber }],
    });

    if (existingUser) {
      // Tell the user WHICH field conflicted, without leaking whether the
      // other field also exists in the system — minor privacy hygiene.
      const conflictField = existingUser.email === email.toLowerCase() ? 'email' : 'phone number';
      return res.status(409).json({ message: `An account with this ${conflictField} already exists.` });
    }

    // Password gets hashed automatically by the pre-save hook — we just
    // assign the plain value here and let the schema middleware handle it.
    const newUser = new User({
      fullName,
      email,
      phoneNumber,
      password,
      isVegetarian,
      drinksAlcohol,
      photoURL: photoURL || null,
    });

    const savedUser = await newUser.save();

    const token = generateToken(savedUser._id);
    res.cookie('token', token, cookieOptions);

    // Explicitly strip password before sending back, even though
    // select:false should already prevent it from being in savedUser's
    // JSON — defense in depth again, and makes the response shape
    // intentional and readable at a glance.
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
    console.error(error);
    res.status(500).json({ message: 'Server error during registration.' });
  }
}

// ===== POST /api/auth/login =====
async function login(req, res) {
  try {
    const { identifier, password } = req.body;
    // `identifier` is EITHER an email or a phone number — the frontend
    // sends whichever the user typed into a single field, and we figure
    // out which one it is server-side.

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Email/phone and password are required.' });
    }

    // .select('+password') OVERRIDES the schema's select:false just for
    // this one query — necessary here since we need the hash to actually
    // compare it, but nowhere else in the app should ever need this override.
    const user = await User.findOne({
      $or: [{ email: identifier.toLowerCase() }, { phoneNumber: identifier }],
    }).select('+password');

    // ----- TIMING-ATTACK-RESISTANT COMPARISON -----
    // If we returned "user not found" immediately when `user` is null, but
    // ran a full bcrypt.compare (which takes measurable, consistent time)
    // when the user DOES exist but the password is wrong, an attacker could
    // theoretically measure response-time differences to figure out which
    // emails/phones are registered accounts, even without ever seeing a
    // successful login. Using the SAME generic error message AND ensuring
    // both branches do comparable work closes that gap. We use a dummy
    // bcrypt comparison against a fake hash when no user is found, so the
    // response time is statistically similar either way.
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
    console.error(error);
    res.status(500).json({ message: 'Server error during login.' });
  }
}

// ===== POST /api/auth/logout =====
function logout(req, res) {
  // clearCookie needs to be called with the SAME options used to set it
  // (specifically httpOnly/secure/sameSite) or some browsers won't
  // actually clear it. maxAge isn't needed here since we're removing it,
  // not setting a new expiry.
  res.clearCookie('token', {
    httpOnly: cookieOptions.httpOnly,
    secure: cookieOptions.secure,
    sameSite: cookieOptions.sameSite,
  });
  res.status(200).json({ message: 'Logged out successfully.' });
}

// ===== GET /api/auth/me =====
// This route sits BEHIND the `protect` middleware (wired in the routes
// file below), so by the time this function runs, req.user is already
// populated and verified. This route's only job is to hand that back.
function getMe(req, res) {
  res.status(200).json({ user: req.user });
}

// ===== PATCH /api/auth/me - Update the logged-in user's own profile =====
async function updateMe(req, res) {
  try {
    const { fullName, photoURL } = req.body;
    const updates = {};

    if (fullName !== undefined) {
      if (!fullName.trim()) return res.status(400).json({ message: 'Name cannot be empty.' });
      updates.fullName = fullName.trim();
    }

    // photoURL can be a real string OR explicitly null (removing the photo) —
    // so we check `!== undefined` rather than truthiness, or "remove photo"
    // (photoURL: null) would be silently ignored.
    if (photoURL !== undefined) {
      updates.photoURL = photoURL;
    }

    const updatedUser = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });
    res.status(200).json({ user: updatedUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while updating profile.' });
  }
}

module.exports = { register, login, logout, getMe, updateMe };