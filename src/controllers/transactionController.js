const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const Category = require('../models/Category');
const Notification = require('../models/Notification');
const Budget = require('../models/Budget');

// Helper to check budget and send notification if exceeded or >80%
const checkBudgetAlerts = async (userId, amount, categoryId, categoryName) => {
  try {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const startOfMonth = new Date(currentYear, now.getMonth(), 1);
    const endOfMonth = new Date(currentYear, now.getMonth() + 1, 0, 23, 59, 59);

    // Get current month total expenses
    const totalExpensesAgg = await Transaction.aggregate([
      {
        $match: {
          user: userId,
          type: 'expense',
          date: { $gte: startOfMonth, $lte: endOfMonth },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const currentMonthSpent = totalExpensesAgg[0]?.total || 0;

    // Fetch budget
    const budget = await Budget.findOne({ user: userId, month: currentMonth, year: currentYear });
    if (budget && budget.overallBudget > 0) {
      const percentage = (currentMonthSpent / budget.overallBudget) * 100;
      if (currentMonthSpent >= budget.overallBudget) {
        await Notification.create({
          user: userId,
          title: 'Monthly Budget Exceeded!',
          message: `You have spent ₹${currentMonthSpent.toLocaleString()} which exceeds your monthly budget of ₹${budget.overallBudget.toLocaleString()}.`,
          type: 'budget_exceeded',
        });
      } else if (percentage >= 80) {
        await Notification.create({
          user: userId,
          title: 'Budget Alert (80%+)',
          message: `You have used ${Math.round(percentage)}% of your monthly budget (₹${currentMonthSpent.toLocaleString()} / ₹${budget.overallBudget.toLocaleString()}).`,
          type: 'budget_warning',
        });
      }
    }

    // Large transaction alert (e.g. over ₹10,000)
    if (amount >= 10000) {
      await Notification.create({
        user: userId,
        title: 'Large Expense Recorded',
        message: `An expense of ₹${amount.toLocaleString()} was logged under ${categoryName || 'General'}.`,
        type: 'large_transaction',
      });
    }
  } catch (err) {
    console.error('Error checking budget alerts:', err.message);
  }
};

// @desc    Get transactions with search, filter, sort and pagination
// @route   GET /api/transactions
// @access  Private
const getTransactions = async (req, res, next) => {
  try {
    const {
      search,
      category,
      account,
      type,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      sortBy = 'newest',
      page = 1,
      limit = 15,
      all = false,
    } = req.query;

    const filter = { user: req.user.id };

    if (type && type !== 'all') {
      filter.type = type;
    }

    if (category && category !== 'all') {
      filter.category = category;
    }

    if (account && account !== 'all') {
      filter.account = account;
    }

    if (minAmount || maxAmount) {
      filter.amount = {};
      if (minAmount) filter.amount.$gte = Number(minAmount);
      if (maxAmount) filter.amount.$lte = Number(maxAmount);
    }

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { description: searchRegex },
        { categoryName: searchRegex },
        { accountName: searchRegex },
        { notes: searchRegex },
        { paymentMethod: searchRegex },
      ];
    }

    // Sort order
    let sortOptions = { date: -1, createdAt: -1 };
    if (sortBy === 'oldest') {
      sortOptions = { date: 1, createdAt: 1 };
    } else if (sortBy === 'highest') {
      sortOptions = { amount: -1 };
    } else if (sortBy === 'lowest') {
      sortOptions = { amount: 1 };
    }

    const totalCount = await Transaction.countDocuments(filter);

    let query = Transaction.find(filter)
      .populate('category', 'name icon color type')
      .populate('account', 'name type color icon')
      .sort(sortOptions);

    if (all !== 'true' && all !== true) {
      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 15;
      query = query.skip((pageNum - 1) * limitNum).limit(limitNum);
    }

    const transactions = await query;

    res.json({
      success: true,
      count: transactions.length,
      totalCount,
      totalPages: all === 'true' || all === true ? 1 : Math.ceil(totalCount / (parseInt(limit, 10) || 15)),
      currentPage: parseInt(page, 10) || 1,
      transactions,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single transaction by ID
// @route   GET /api/transactions/:id
// @access  Private
const getTransactionById = async (req, res, next) => {
  try {
    const transaction = await Transaction.findOne({ _id: req.params.id, user: req.user.id })
      .populate('category')
      .populate('account');

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    res.json({
      success: true,
      transaction,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new transaction
// @route   POST /api/transactions
// @access  Private
const createTransaction = async (req, res, next) => {
  try {
    const {
      type,
      amount,
      description,
      category,
      account,
      date,
      paymentMethod,
      notes,
      attachment,
      tags,
    } = req.body;

    if (!type || !amount || !description || !category || !account) {
      return res.status(400).json({
        success: false,
        message: 'Please provide type, amount, description, category, and account',
      });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Please provide a valid positive amount' });
    }

    const [categoryDoc, accountDoc] = await Promise.all([
      Category.findOne({ _id: category, user: req.user.id }),
      Account.findOne({ _id: account, user: req.user.id }),
    ]);

    if (!categoryDoc) {
      return res.status(400).json({ success: false, message: 'Selected category does not exist' });
    }
    if (!accountDoc) {
      return res.status(400).json({ success: false, message: 'Selected account does not exist' });
    }

    let attachmentPath = attachment || '';
    if (req.file) {
      attachmentPath = `/uploads/${req.file.filename}`;
    }

    const transaction = await Transaction.create({
      user: req.user.id,
      type,
      amount: numAmount,
      description: description.trim(),
      category: categoryDoc._id,
      categoryName: categoryDoc.name,
      account: accountDoc._id,
      accountName: accountDoc.name,
      date: date ? new Date(date) : new Date(),
      paymentMethod: paymentMethod || accountDoc.type,
      notes: notes || '',
      attachment: attachmentPath,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
    });

    // Update Account balance
    if (type === 'income') {
      accountDoc.balance += numAmount;
    } else {
      accountDoc.balance -= numAmount;
    }
    await accountDoc.save();

    // Check alerts asynchronously
    if (type === 'expense') {
      checkBudgetAlerts(req.user.id, numAmount, categoryDoc._id, categoryDoc.name);
    }

    // Populate for immediate return
    await transaction.populate('category', 'name icon color type');
    await transaction.populate('account', 'name type color icon');

    res.status(201).json({
      success: true,
      transaction,
      updatedAccountBalance: accountDoc.balance,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update existing transaction
// @route   PUT /api/transactions/:id
// @access  Private
const updateTransaction = async (req, res, next) => {
  try {
    const {
      type,
      amount,
      description,
      category,
      account,
      date,
      paymentMethod,
      notes,
      attachment,
    } = req.body;

    const existingTx = await Transaction.findOne({ _id: req.params.id, user: req.user.id });
    if (!existingTx) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    // Revert previous effect on previous account
    const oldAccount = await Account.findById(existingTx.account);
    if (oldAccount) {
      if (existingTx.type === 'income') {
        oldAccount.balance -= existingTx.amount;
      } else {
        oldAccount.balance += existingTx.amount;
      }
      await oldAccount.save();
    }

    const newAmount = amount !== undefined ? Number(amount) : existingTx.amount;
    const newType = type || existingTx.type;

    let targetAccountId = account || existingTx.account;
    const targetAccount = await Account.findOne({ _id: targetAccountId, user: req.user.id });
    if (!targetAccount) {
      return res.status(400).json({ success: false, message: 'Target account not found' });
    }

    let categoryDoc = existingTx.category;
    let categoryName = existingTx.categoryName;
    if (category && category !== existingTx.category.toString()) {
      const cat = await Category.findOne({ _id: category, user: req.user.id });
      if (cat) {
        categoryDoc = cat._id;
        categoryName = cat.name;
      }
    }

    let attachmentPath = attachment !== undefined ? attachment : existingTx.attachment;
    if (req.file) {
      attachmentPath = `/uploads/${req.file.filename}`;
    }

    existingTx.type = newType;
    existingTx.amount = newAmount;
    if (description) existingTx.description = description.trim();
    existingTx.category = categoryDoc;
    existingTx.categoryName = categoryName;
    existingTx.account = targetAccount._id;
    existingTx.accountName = targetAccount.name;
    if (date) existingTx.date = new Date(date);
    if (paymentMethod) existingTx.paymentMethod = paymentMethod;
    if (notes !== undefined) existingTx.notes = notes;
    existingTx.attachment = attachmentPath;

    await existingTx.save();

    // Apply new balance change to target account
    if (newType === 'income') {
      targetAccount.balance += newAmount;
    } else {
      targetAccount.balance -= newAmount;
    }
    await targetAccount.save();

    await existingTx.populate('category', 'name icon color type');
    await existingTx.populate('account', 'name type color icon');

    res.json({
      success: true,
      transaction: existingTx,
      updatedAccountBalance: targetAccount.balance,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete transaction
// @route   DELETE /api/transactions/:id
// @access  Private
const deleteTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findOne({ _id: req.params.id, user: req.user.id });
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    // Revert account balance
    const account = await Account.findById(transaction.account);
    if (account) {
      if (transaction.type === 'income') {
        account.balance -= transaction.amount;
      } else {
        account.balance += transaction.amount;
      }
      await account.save();
    }

    await Transaction.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Transaction deleted successfully',
      updatedAccountBalance: account ? account.balance : undefined,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Import transactions in bulk (from CSV parsed rows)
// @route   POST /api/transactions/import
// @access  Private
const importTransactions = async (req, res, next) => {
  try {
    const { rows } = req.body;
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No rows provided for import' });
    }

    const userCategories = await Category.find({ user: req.user.id });
    const userAccounts = await Account.find({ user: req.user.id });

    let defaultAccount = userAccounts[0];
    let defaultExpenseCat = userCategories.find(c => c.type === 'expense') || userCategories[0];
    let defaultIncomeCat = userCategories.find(c => c.type === 'income') || userCategories[0];

    const validDocs = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      // Expected headers: Date, Description, Category, Amount, Type, Account
      const dateVal = row.Date || row.date;
      const descVal = row.Description || row.description;
      const catVal = row.Category || row.category;
      const amtVal = row.Amount || row.amount;
      const typeVal = (row.Type || row.type || 'expense').toLowerCase();
      const accVal = row.Account || row.account;

      if (!descVal || !amtVal || isNaN(Number(amtVal))) {
        errors.push(`Row ${i + 1}: Missing or invalid description/amount`);
        continue;
      }

      const parsedAmount = Math.abs(Number(amtVal));
      const parsedType = typeVal.includes('inc') ? 'income' : 'expense';

      // Match category or default
      let matchedCat = userCategories.find(c => c.name.toLowerCase() === (catVal || '').toLowerCase().trim());
      if (!matchedCat) {
        matchedCat = parsedType === 'income' ? defaultIncomeCat : defaultExpenseCat;
      }

      // Match account or default
      let matchedAcc = userAccounts.find(a => a.name.toLowerCase() === (accVal || '').toLowerCase().trim());
      if (!matchedAcc) {
        matchedAcc = defaultAccount;
      }

      const parsedDate = dateVal ? new Date(dateVal) : new Date();

      validDocs.push({
        user: req.user.id,
        type: parsedType,
        amount: parsedAmount,
        description: descVal.trim(),
        category: matchedCat._id,
        categoryName: matchedCat.name,
        account: matchedAcc._id,
        accountName: matchedAcc.name,
        date: isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
        paymentMethod: matchedAcc.type,
      });

      // Adjust account balance in-memory for save
      if (parsedType === 'income') {
        matchedAcc.balance += parsedAmount;
      } else {
        matchedAcc.balance -= parsedAmount;
      }
    }

    if (validDocs.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Could not import any rows. Please check file format.',
        errors,
      });
    }

    await Transaction.insertMany(validDocs);

    // Save updated account balances
    for (const acc of userAccounts) {
      await acc.save();
    }

    res.status(201).json({
      success: true,
      importedCount: validDocs.length,
      errorsCount: errors.length,
      errors: errors.slice(0, 5), // top errors
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  importTransactions,
};
