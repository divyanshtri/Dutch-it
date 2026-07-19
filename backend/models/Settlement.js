const mongoose = require('mongoose');

// A Settlement records a REAL repayment — actual money changing hands between
// two friends. This is completely separate from Expense: an Expense represents
// "money spent and who's responsible for it," while a Settlement represents
// "money that has already been paid back to resolve some of that responsibility."
const settlementSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
    },

    // The person GIVING money (paying back what they owed)
    payer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // The person RECEIVING money
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true, // useful later for a "settlement history" / activity feed
  }
);

module.exports = mongoose.model('Settlement', settlementSchema);