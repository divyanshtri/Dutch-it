const mongoose = require('mongoose');
const crypto = require('crypto');

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    shareToken: {
      type: String,
      unique: true,
      sparse: true,
      default: () => crypto.randomUUID(),
      index: true,
    },
  },
  {
    timestamps: true,
    strict: 'throw',
  }
);

module.exports = mongoose.model('Group', groupSchema);
