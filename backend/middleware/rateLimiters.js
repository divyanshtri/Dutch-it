const rateLimit = require('express-rate-limit');

// Strict rate limit for authentication endpoints to block brute-force attempts
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 8, // Limit each IP to 8 requests per windowMs
  message: { message: 'Too many attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Moderate baseline rate limit for general public/read endpoints
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { message: 'Too many requests. Please slow down.' },
});

// Loose rate limit for authenticated user write operations (creating expenses, groups, etc.)
const actionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { message: 'Action limit reached. Please wait a few minutes before trying again.' },
});

module.exports = { authLimiter, generalLimiter, actionLimiter };