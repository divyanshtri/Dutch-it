const jwt = require('jsonwebtoken');
const User = require('../models/User');

// This middleware runs BEFORE any route it's attached to. If the token is
// valid, it attaches the full user document to req.user and calls next()
// to proceed. If not, it stops the request right here with a 401 — the
// actual route handler never even runs.
async function protect(req, res, next) {
  try {
    const token = req.cookies?.token;
    // req.cookies only exists because we'll add the cookie-parser
    // middleware in server.js — without it, req.cookies is undefined and
    // this whole thing breaks silently.

    if (!token) {
      return res.status(401).json({ message: 'Not authenticated. Please log in.' });
    }

    // jwt.verify does two things at once: checks the signature is valid
    // (proves WE issued this token, using our secret — nobody can forge
    // one without knowing JWT_SECRET) AND checks it hasn't expired.
    // It throws if either check fails.
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // .select('-password') is redundant given schema's select:false on
    // password, but explicit here as defense-in-depth — makes the
    // intent obvious to anyone reading this file in isolation.
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      // Token is validly signed, but the user it points to no longer
      // exists (e.g. deleted account) — treat as unauthenticated.
      return res.status(401).json({ message: 'User no longer exists.' });
    }

    req.user = user; // <- this is what makes req.user available in every route after this middleware
    next();

  } catch (error) {
    // Covers both "token expired" (TokenExpiredError) and "token was
    // tampered with / malformed" (JsonWebTokenError) — both should just
    // look like "please log in again" to the client, not a 500 crash.
    return res.status(401).json({ message: 'Invalid or expired session. Please log in again.' });
  }
}

module.exports = protect;