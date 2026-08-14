const mongoose = require('mongoose');

const lineItemSchema = new mongoose.Schema(
  {
    itemName: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    dietaryTag: {
      type: String,
      enum: ['veg', 'non-veg', 'neutral'],
      default: 'neutral',
    },
    isAlcohol: {
      type: Boolean,
      default: false,
    },
    splitAmong: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    strict: 'throw',
  }
);

const expenseSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Split category configuration
    splitType: {
      type: String,
      enum: ['itemized', 'equally', 'unequally', 'percentage'],
      default: 'itemized',
    },

    // Used for unequally, equally, or percentage-based custom splits
    splits: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        amount: {
          type: Number,
          min: 0,
        },
        percentage: {
          type: Number,
          min: 0,
          max: 100,
        },
      },
    ],

    // Member preference categories preserved for itemized splits
    vegMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    nonVegMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    alcoholMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    lineItems: [lineItemSchema],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Expense', expenseSchema);