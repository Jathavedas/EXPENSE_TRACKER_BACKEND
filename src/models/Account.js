const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Please provide account name'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['Cash', 'Bank', 'UPI', 'Credit Card', 'Debit Card', 'Savings', 'Wallet', 'Custom'],
      default: 'Bank',
    },
    balance: {
      type: Number,
      default: 0,
    },
    initialBalance: {
      type: Number,
      default: 0,
    },
    accountNumber: {
      type: String,
      trim: true,
      default: '',
    },
    color: {
      type: String,
      default: '#3B82F6', // default blue
    },
    icon: {
      type: String,
      default: 'Landmark',
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Account', accountSchema);
