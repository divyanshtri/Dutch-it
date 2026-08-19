const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const groupRoutes = require('./routes/groupRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const settlementRoutes = require('./routes/settlementRoutes');
const receiptRoutes = require('./routes/receiptRoutes');
const friendRoutes = require('./routes/friendRoutes');
const activityRoutes = require('./routes/activityRoutes');
const nudgeRoutes = require('./routes/nudgeRoutes');
const errorHandler = require('./middleware/errorHandler');
const { authLimiter, generalLimiter } = require('./middleware/rateLimiters');

const cookieParser = require('cookie-parser');

const app = express();

// Updated CORS configuration to dynamically use process.env.CLIENT_URL
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

app.use(cookieParser());

// Raised JSON body limit to 5MB to accommodate base64 profile picture uploads
app.use(express.json({ limit: '5mb' }));

// ===== RATE LIMITERS =====
// Strict rate limiter applied specifically to high-risk auth routes
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Baseline moderate rate limiter applied across all API endpoints
app.use('/api/', generalLimiter);

// ===== API ROUTES =====
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/nudges', nudgeRoutes);

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Dutch It API is running 🍽️' });
});

// ===== CENTRALIZED ERROR HANDLER =====
app.use(errorHandler);

// ===== DATABASE CONNECTION =====
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB Atlas connected successfully');
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});