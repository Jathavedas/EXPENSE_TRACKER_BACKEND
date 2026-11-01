const Account = require('../models/Account');
const Transaction = require('../models/Transaction');

// @desc    Get all accounts for user with live income/expense totals
// @route   GET /api/accounts
// @access  Private
const getAccounts = async (req, res, next) => {
  try {
    const accounts = await Account.find({ user: req.user.id, isArchived: false }).sort({ isDefault: -1, createdAt: 1 });

    // Aggregate transactions per account to get real-time total income & total expense
    const stats = await Transaction.aggregate([
      { $match: { user: req.user._id } },
      {
        $group: {
          _id: { account: '$account', type: '$type' },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    // Map stats by accountId
    const statsMap = {};
    stats.forEach(item => {
      const accId = item._id.account ? item._id.account.toString() : null;
      if (!accId) return;
      if (!statsMap[accId]) {
        statsMap[accId] = { totalIncome: 0, totalExpense: 0, transactionCount: 0 };
      }
      if (item._id.type === 'income') {
        statsMap[accId].totalIncome = item.total;
      } else if (item._id.type === 'expense') {
        statsMap[accId].totalExpense = item.total;
      }
      statsMap[accId].transactionCount += item.count;
    });

    const accountsWithStats = accounts.map(acc => {
      const accObj = acc.toObject();
      const accStat = statsMap[acc._id.toString()] || { totalIncome: 0, totalExpense: 0, transactionCount: 0 };
      accObj.totalIncome = accStat.totalIncome;
      accObj.totalExpense = accStat.totalExpense;
      accObj.transactionCount = accStat.transactionCount;
      return accObj;
    });

    res.json({
      success: true,
      count: accountsWithStats.length,
      accounts: accountsWithStats,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new account
// @route   POST /api/accounts
// @access  Private
const createAccount = async (req, res, next) => {
  try {
    const { name, type, balance, initialBalance, accountNumber, color, icon, isDefault } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Account name is required' });
    }

    const startingBalance = Number(balance ?? initialBalance ?? 0);

    // If marked default, unset other defaults
    if (isDefault) {
      await Account.updateMany({ user: req.user.id }, { isDefault: false });
    }

    const account = await Account.create({
      user: req.user.id,
      name,
      type: type || 'Bank',
      balance: startingBalance,
      initialBalance: startingBalance,
      accountNumber: accountNumber || '',
      color: color || '#3B82F6',
      icon: icon || 'Landmark',
      isDefault: Boolean(isDefault),
    });

    res.status(201).json({
      success: true,
      account,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update account
// @route   PUT /api/accounts/:id
// @access  Private
const updateAccount = async (req, res, next) => {
  try {
    const { name, type, balance, accountNumber, color, icon, isDefault } = req.body;

    let account = await Account.findOne({ _id: req.params.id, user: req.user.id });
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    if (isDefault) {
      await Account.updateMany({ user: req.user.id, _id: { $ne: req.params.id } }, { isDefault: false });
    }

    if (name) account.name = name;
    if (type) account.type = type;
    if (balance !== undefined) account.balance = Number(balance);
    if (accountNumber !== undefined) account.accountNumber = accountNumber;
    if (color) account.color = color;
    if (icon) account.icon = icon;
    if (isDefault !== undefined) account.isDefault = Boolean(isDefault);

    await account.save();

    res.json({
      success: true,
      account,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete account (safe check)
// @route   DELETE /api/accounts/:id
// @access  Private
const deleteAccount = async (req, res, next) => {
  try {
    const account = await Account.findOne({ _id: req.params.id, user: req.user.id });
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    // Check if transactions exist
    const txCount = await Transaction.countDocuments({ user: req.user.id, account: req.params.id });
    if (txCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete account because it contains ${txCount} transaction(s). Reassign or delete transactions first.`,
      });
    }

    await Account.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
};
