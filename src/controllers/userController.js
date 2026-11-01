const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const Category = require('../models/Category');
const Budget = require('../models/Budget');
const RecurringTransaction = require('../models/RecurringTransaction');
const Notification = require('../models/Notification');

// @desc    Export entire user data as JSON backup
// @route   GET /api/user/export-all
// @access  Private
const exportAllData = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [user, transactions, accounts, categories, budgets, recurring, notifications] = await Promise.all([
      User.findById(userId).select('-password'),
      Transaction.find({ user: userId }),
      Account.find({ user: userId }),
      Category.find({ user: userId }),
      Budget.find({ user: userId }),
      RecurringTransaction.find({ user: userId }),
      Notification.find({ user: userId }),
    ]);

    res.json({
      success: true,
      exportDate: new Date(),
      user,
      counts: {
        transactions: transactions.length,
        accounts: accounts.length,
        categories: categories.length,
        recurring: recurring.length,
      },
      data: {
        transactions,
        accounts,
        categories,
        budgets,
        recurring,
        notifications,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Clear all transactions (Reset data)
// @route   POST /api/user/reset-data
// @access  Private
const resetUserData = async (req, res, next) => {
  try {
    const userId = req.user.id;
    await Transaction.deleteMany({ user: userId });
    await Notification.deleteMany({ user: userId });

    // Reset account balances to initialBalance
    const accounts = await Account.find({ user: userId });
    for (const acc of accounts) {
      acc.balance = acc.initialBalance || 0;
      await acc.save();
    }

    res.json({
      success: true,
      message: 'All transactions have been cleared and account balances reset.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Permanently delete account
// @route   DELETE /api/user/account
// @access  Private
const deleteAccount = async (req, res, next) => {
  try {
    const userId = req.user.id;
    await Promise.all([
      Transaction.deleteMany({ user: userId }),
      Account.deleteMany({ user: userId }),
      Category.deleteMany({ user: userId }),
      Budget.deleteMany({ user: userId }),
      RecurringTransaction.deleteMany({ user: userId }),
      Notification.deleteMany({ user: userId }),
      User.findByIdAndDelete(userId),
    ]);

    res.json({
      success: true,
      message: 'Your account and all associated financial records have been deleted permanently.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  exportAllData,
  resetUserData,
  deleteAccount,
};
