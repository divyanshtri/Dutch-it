const express = require('express'); 
const mongoose = require('mongoose'); 
const cors = require('cors'); // Middleware to allow cross-origin requests
require('dotenv').config(); 

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const groupRoutes = require('./routes/groupRoutes'); 
const expenseRoutes = require('./routes/expenseRoutes');
const settlementRoutes = require('./routes/settlementRoutes');
const receiptRoutes = require('./routes/receiptRoutes');
const friendRoutes = require('./routes/friendRoutes');
const activityRoutes = require('./routes/activityRoutes'); // Activity feed route

const cookieParser = require('cookie-parser');

const app = express();

app.use(cors({
  origin: 'http://localhost:5173', // must be an explicit origin, NOT '*', when credentials:true
  credentials: true,
}));

app.use(cookieParser());

// Raised JSON body limit to 5MB to accommodate base64 profile picture uploads
app.use(express.json({ limit: '5mb' }));

// ===== API ROUTES =====
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/activity', activityRoutes); // Mounted activity feed endpoint

// ===== DATABASE CONNECTION =====
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB Atlas connected successfully');
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    // Exit process if DB connection fails
    process.exit(1);
  });

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Dutch It API is running 🍽️' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});