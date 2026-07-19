
const express = require('express');   
const mongoose = require('mongoose'); 
const cors = require('cors');         // Middleware to allow cross-origin requests (needed later when React frontend calls this API from a different port)
require('dotenv').config();       
const userRoutes = require('./routes/userRoutes');
const groupRoutes = require('./routes/groupRoutes');    
const expenseRoutes = require('./routes/expenseRoutes');
const settlementRoutes = require('./routes/settlementRoutes');


const app = express();

app.use(cors());

app.use(express.json());

app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/settlements', settlementRoutes);


mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB Atlas connected successfully');
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    // If the DB connection fails, there's no point running a half-working server,
    // so we exit the process entirely.
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