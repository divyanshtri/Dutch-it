const jwt = require('jsonwebtoken');
const User = require('../models/User');

// This middleware runs BEFORE any route it's attached to. If the token is
// valid, it attaches the full user document to req.user and calls next()
// to proceed. If not, it stops the request right here with a 401 — the
// actual route handler never even runs.
async function protect(req, res, next) {
  try {
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({ message: 'Not authenticated. Please log in.' });
    }

    // Explicitly pin the expected algorithm ('HS256') to close algorithm-confusion attacks
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });

    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ message: 'User no longer exists.' });
    }

    req.user = user;
    next();

  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired session. Please log in again.' });
  }
}

module.exports = protect;