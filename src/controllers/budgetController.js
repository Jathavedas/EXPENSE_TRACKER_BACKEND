const Budget = require('../models/Budget');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');

// @desc    Get budget for specific month and year, with current spending calculations
// @route   GET /api/budgets
// @access  Private
const getBudget = async (req, res, next) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month, 10) || now.getMonth() + 1; // 1-12
    const year = parseInt(req.query.year, 10) || now.getFullYear();

    let budget = await Budget.findOne({ user: req.user.id, month, year }).populate('categoryBudgets.category', 'name icon color');

    // If budget doesn't exist for this month, find previous or create default
    if (!budget) {
      const defaultOverall = req.user.monthlyBudget || 30000;
      const expenseCategories = await Category.find({ user: req.user.id, type: 'expense' });

      const categoryBudgets = expenseCategories
        .filter(c => c.monthlyBudget > 0)
        .map(c => ({
          category: c._id,
          categoryName: c.name,
          amount: c.monthlyBudget,
        }));

      budget = await Budget.create({
        user: req.user.id,
        month,
        year,
        overallBudget: defaultOverall,
        categoryBudgets,
      });

      await budget.populate('categoryBudgets.category', 'name icon color');
    }

    // Calculate actual spending for this month & year
    const startDate = new Date(year, month - 1, 1, 0, 0, 0);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const expenseStats = await Transaction.aggregate([
      {
        $match: {
          user: req.user._id,
          type: 'expense',
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$category',
          totalSpent: { $sum: '$amount' },
        },
      },
    ]);

    const spentMap = {};
    let totalSpentOverall = 0;
    expenseStats.forEach(item => {
      if (item._id) {
        spentMap[item._id.toString()] = item.totalSpent;
      }
      totalSpentOverall += item.totalSpent;
    });

    const categoryBudgetsWithSpent = budget.categoryBudgets.map(cb => {
      const catId = cb.category ? (cb.category._id || cb.category).toString() : null;
      const spent = catId ? (spentMap[catId] || 0) : 0;
      const budgetAmount = cb.amount || 0;
      const remaining = budgetAmount - spent;
      const percentage = budgetAmount > 0 ? Math.min(Math.round((spent / budgetAmount) * 100), 999) : 0;
      let status = 'normal';
      if (percentage >= 100) status = 'exceeded';
      else if (percentage >= 80) status = 'warning';

      return {
        _id: cb._id,
        category: cb.category,
        categoryName: cb.categoryName || (cb.category ? cb.category.name : 'Unknown'),
        amount: budgetAmount,
        spent,
        remaining,
        percentage,
        status,
      };
    });

    const overallRemaining = budget.overallBudget - totalSpentOverall;
    const overallPercentage = budget.overallBudget > 0 ? Math.round((totalSpentOverall / budget.overallBudget) * 100) : 0;

    res.json({
      success: true,
      budget: {
        _id: budget._id,
        month: budget.month,
        year: budget.year,
        overallBudget: budget.overallBudget,
        totalSpent: totalSpentOverall,
        remaining: overallRemaining,
        percentage: overallPercentage,
        status: overallPercentage >= 100 ? 'exceeded' : overallPercentage >= 80 ? 'warning' : 'normal',
        categoryBudgets: categoryBudgetsWithSpent,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update or create monthly budget
// @route   POST /api/budgets
// @access  Private
const setBudget = async (req, res, next) => {
  try {
    const { month, year, overallBudget, categoryBudgets } = req.body;

    if (!month || !year || overallBudget === undefined) {
      return res.status(400).json({ success: false, message: 'Please provide month, year, and overall budget' });
    }

    let budget = await Budget.findOne({ user: req.user.id, month, year });

    if (!budget) {
      budget = new Budget({
        user: req.user.id,
        month,
        year,
        overallBudget: Number(overallBudget),
        categoryBudgets: categoryBudgets || [],
      });
    } else {
      budget.overallBudget = Number(overallBudget);
      if (categoryBudgets) {
        budget.categoryBudgets = categoryBudgets;
      }
    }

    await budget.save();
    await budget.populate('categoryBudgets.category', 'name icon color');

    res.json({
      success: true,
      budget,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBudget,
  setBudget,
};
