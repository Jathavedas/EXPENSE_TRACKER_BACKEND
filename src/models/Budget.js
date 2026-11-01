const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    month: {
      type: Number,
      required: true, // 1 - 12
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true, // e.g. 2026
    },
    overallBudget: {
      type: Number,
      required: true,
      default: 30000,
    },
    categoryBudgets: [
      {
        category: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Category',
          required: true,
        },
        categoryName: {
          type: String,
        },
        amount: {
          type: Number,
          required: true,
          default: 0,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

budgetSchema.index({ user: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Budget', budgetSchema);
