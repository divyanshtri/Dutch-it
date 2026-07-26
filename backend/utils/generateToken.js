const jwt = require('jsonwebtoken');

// Signs a JWT containing just the user's ID — deliberately minimal payload.
// We don't embed email, name, or anything else in the token itself, because
// JWT payloads are BASE64-ENCODED, not encrypted — anyone who has the token
// string can decode and read the payload trivially (try it on jwt.io).
// Keeping only the ID means even if a token leaks, it doesn't itself expose
// personal info. Anything else the frontend needs comes from GET /api/auth/me.
function generateToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

module.exports = generateToken;