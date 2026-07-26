const mongoose = require('mongoose');


const lineItemSchema = new mongoose.Schema({
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

  quantity: {  // NEW
    type: Number, 
    required: true, 
    min: 1, 
    default: 1 
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
  // THIS is the schema that would have caught your `"tag": "veg"` typo.
  // The parent Expense schema being strict doesn't protect the fields
  // living inside each embedded line item — each nested schema enforces
  // its own rules independently.
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
  // ...inside expenseSchema, alongside your existing fields...

  vegMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  nonVegMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  alcoholMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // We save these so that later — when calculating cumulative group balances —
  // we can re-run the exact same split logic for THIS bill without needing
  // the original frontend request again. Without saving these, an old Expense
  // document would be "unrecoverable" for balance calculations.
    lineItems: [lineItemSchema],
  },

  {
    timestamps: true,
  }
);



module.exports = mongoose.model('Expense', expenseSchema);