const RecurringTransaction = require('../models/RecurringTransaction');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const Category = require('../models/Category');

// Helper to calculate next occurrence based on frequency
const calculateNextDate = (currentDate, frequency) => {
  const next = new Date(currentDate);
  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
    case 'monthly':
    default:
      next.setMonth(next.getMonth() + 1);
      break;
  }
  return next;
};

// @desc    Get all recurring transactions for user
// @route   GET /api/recurring
// @access  Private
const getRecurring = async (req, res, next) => {
  try {
    const list = await RecurringTransaction.find({ user: req.user.id })
      .populate('category', 'name icon color')
      .populate('account', 'name type color')
      .sort({ nextOccurrence: 1 });

    const now = new Date();
    // Mark items that are due within 7 days as upcoming
    const enriched = list.map(item => {
      const itemObj = item.toObject();
      const diffDays = Math.ceil((new Date(item.nextOccurrence) - now) / (1000 * 60 * 60 * 24));
      itemObj.daysUntilDue = diffDays;
      itemObj.isDueSoon = diffDays <= 3 && diffDays >= 0;
      itemObj.isOverdue = diffDays < 0;
      return itemObj;
    });

    res.json({
      success: true,
      count: enriched.length,
      recurring: enriched,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create recurring transaction
// @route   POST /api/recurring
// @access  Private
const createRecurring = async (req, res, next) => {
  try {
    const {
      name,
      amount,
      type = 'expense',
      category,
      account,
      frequency = 'monthly',
      startDate,
      endDate,
      nextOccurrence,
      notes,
    } = req.body;

    if (!name || !amount || !category || !account) {
      return res.status(400).json({ success: false, message: 'Please provide name, amount, category, and account' });
    }

    const [categoryDoc, accountDoc] = await Promise.all([
      Category.findOne({ _id: category, user: req.user.id }),
      Account.findOne({ _id: account, user: req.user.id }),
    ]);

    if (!categoryDoc || !accountDoc) {
      return res.status(400).json({ success: false, message: 'Invalid category or account' });
    }

    const start = startDate ? new Date(startDate) : new Date();
    const nextDate = nextOccurrence ? new Date(nextOccurrence) : start;

    const recurring = await RecurringTransaction.create({
      user: req.user.id,
      name: name.trim(),
      amount: Number(amount),
      type,
      category: categoryDoc._id,
      categoryName: categoryDoc.name,
      account: accountDoc._id,
      accountName: accountDoc.name,
      frequency,
      startDate: start,
      endDate: endDate ? new Date(endDate) : undefined,
      nextOccurrence: nextDate,
      notes: notes || '',
      isActive: true,
    });

    await recurring.populate('category', 'name icon color');
    await recurring.populate('account', 'name type color');

    res.status(201).json({
      success: true,
      recurring,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Manually process / log recurring transaction instance
// @route   POST /api/recurring/:id/process
// @access  Private
const processRecurringNow = async (req, res, next) => {
  try {
    const recurring = await RecurringTransaction.findOne({ _id: req.params.id, user: req.user.id });
    if (!recurring) {
      return res.status(404).json({ success: false, message: 'Recurring transaction not found' });
    }

    const account = await Account.findById(recurring.account);
    if (!account) {
      return res.status(400).json({ success: false, message: 'Linked account no longer exists' });
    }

    // 1. Create Transaction
    const transaction = await Transaction.create({
      user: req.user.id,
      type: recurring.type,
      amount: recurring.amount,
      description: recurring.name,
      category: recurring.category,
      categoryName: recurring.categoryName,
      account: recurring.account,
      accountName: recurring.accountName,
      date: new Date(),
      paymentMethod: account.type,
      notes: `Recurring Payment (${recurring.frequency}): ${recurring.notes || ''}`,
      isRecurring: true,
      recurringId: recurring._id,
    });

    // 2. Adjust account balance
    if (recurring.type === 'income') {
      account.balance += recurring.amount;
    } else {
      account.balance -= recurring.amount;
    }
    await account.save();

    // 3. Advance nextOccurrence
    recurring.lastProcessedDate = new Date();
    recurring.nextOccurrence = calculateNextDate(recurring.nextOccurrence, recurring.frequency);
    await recurring.save();

    res.json({
      success: true,
      message: `Processed payment of ₹${recurring.amount.toLocaleString()} for ${recurring.name}`,
      transaction,
      nextOccurrence: recurring.nextOccurrence,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update recurring transaction
// @route   PUT /api/recurring/:id
// @access  Private
const updateRecurring = async (req, res, next) => {
  try {
    const recurring = await RecurringTransaction.findOne({ _id: req.params.id, user: req.user.id });
    if (!recurring) {
      return res.status(404).json({ success: false, message: 'Recurring transaction not found' });
    }

    const { name, amount, frequency, nextOccurrence, isActive, notes, category, account } = req.body;

    if (name) recurring.name = name.trim();
    if (amount !== undefined) recurring.amount = Number(amount);
    if (frequency) recurring.frequency = frequency;
    if (nextOccurrence) recurring.nextOccurrence = new Date(nextOccurrence);
    if (isActive !== undefined) recurring.isActive = Boolean(isActive);
    if (notes !== undefined) recurring.notes = notes;

    if (category) {
      const cat = await Category.findOne({ _id: category, user: req.user.id });
      if (cat) {
        recurring.category = cat._id;
        recurring.categoryName = cat.name;
      }
    }

    if (account) {
      const acc = await Account.findOne({ _id: account, user: req.user.id });
      if (acc) {
        recurring.account = acc._id;
        recurring.accountName = acc.name;
      }
    }

    await recurring.save();
    await recurring.populate('category', 'name icon color');
    await recurring.populate('account', 'name type color');

    res.json({
      success: true,
      recurring,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete recurring transaction
// @route   DELETE /api/recurring/:id
// @access  Private
const deleteRecurring = async (req, res, next) => {
  try {
    const recurring = await RecurringTransaction.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!recurring) {
      return res.status(404).json({ success: false, message: 'Recurring transaction not found' });
    }

    res.json({
      success: true,
      message: 'Recurring transaction deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRecurring,
  createRecurring,
  processRecurringNow,
  updateRecurring,
  deleteRecurring,
};
