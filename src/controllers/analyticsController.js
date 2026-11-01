const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const Budget = require('../models/Budget');
const Category = require('../models/Category');

// Helper to get date boundaries based on timeframe
const getDateRange = (timeframe, customStart, customEnd) => {
  const now = new Date();
  let start = new Date();
  let end = new Date();

  switch (timeframe) {
    case 'this_week': {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
      start = new Date(now.setDate(diff));
      start.setHours(0, 0, 0, 0);
      end = new Date();
      break;
    }
    case 'this_month': {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      break;
    }
    case 'last_month': {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      break;
    }
    case 'last_3_months': {
      start = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0);
      end = new Date();
      break;
    }
    case 'last_6_months': {
      start = new Date(now.getFullYear(), now.getMonth() - 5, 1, 0, 0, 0);
      end = new Date();
      break;
    }
    case 'this_year': {
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      break;
    }
    case 'custom': {
      start = customStart ? new Date(customStart) : new Date(now.getFullYear(), now.getMonth(), 1);
      end = customEnd ? new Date(customEnd) : new Date();
      end.setHours(23, 59, 59, 999);
      break;
    }
    default: {
      // Default: this month
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }
  }

  return { start, end };
};

// @desc    Get dashboard metrics & summary
// @route   GET /api/analytics/dashboard
// @access  Private
const getDashboardData = async (req, res, next) => {
  try {
    const { timeframe = 'this_month', customStart, customEnd } = req.query;
    const { start, end } = getDateRange(timeframe, customStart, customEnd);

    const userId = req.user._id;

    // 1. Current Total Balance from all active accounts
    const accounts = await Account.find({ user: userId, isArchived: false });
    const currentBalance = accounts.reduce((acc, a) => acc + (a.balance || 0), 0);

    // 2. Income & Expense for selected timeframe
    const summaryAgg = await Transaction.aggregate([
      {
        $match: {
          user: userId,
          date: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    let totalIncome = 0;
    let totalExpenses = 0;
    summaryAgg.forEach(item => {
      if (item._id === 'income') totalIncome = item.total;
      if (item._id === 'expense') totalExpenses = item.total;
    });

    // 3. Monthly Budget and remaining
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const budgetDoc = await Budget.findOne({ user: userId, month: currentMonth, year: currentYear });
    const monthlyBudgetAmount = budgetDoc ? budgetDoc.overallBudget : (req.user.monthlyBudget || 30000);

    // Month-to-date expenses for true budget calculation
    const startOfCurrentMonth = new Date(currentYear, now.getMonth(), 1);
    const endOfCurrentMonth = new Date(currentYear, now.getMonth() + 1, 0, 23, 59, 59);

    const mtdExpenseAgg = await Transaction.aggregate([
      {
        $match: {
          user: userId,
          type: 'expense',
          date: { $gte: startOfCurrentMonth, $lte: endOfCurrentMonth },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const mtdExpenses = mtdExpenseAgg[0]?.total || 0;
    const remainingBudget = monthlyBudgetAmount - mtdExpenses;
    const budgetUsagePercent = monthlyBudgetAmount > 0 ? Math.round((mtdExpenses / monthlyBudgetAmount) * 100) : 0;

    // 4. Category breakdown (Donut / Pie chart)
    const categoryAgg = await Transaction.aggregate([
      {
        $match: {
          user: userId,
          type: 'expense',
          date: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: { category: '$category', categoryName: '$categoryName' },
          amount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { amount: -1 } },
    ]);

    // Attach category colors
    const categoryIds = categoryAgg.map(c => c._id.category).filter(Boolean);
    const categoryDocs = await Category.find({ _id: { $in: categoryIds } });
    const catMap = {};
    categoryDocs.forEach(c => {
      catMap[c._id.toString()] = { color: c.color, icon: c.icon };
    });

    const categoryDistribution = categoryAgg.map(item => {
      const catIdStr = item._id.category ? item._id.category.toString() : '';
      const meta = catMap[catIdStr] || { color: '#6B7280', icon: 'Tag' };
      const percentage = totalExpenses > 0 ? Math.round((item.amount / totalExpenses) * 100) : 0;
      return {
        categoryId: item._id.category,
        name: item._id.categoryName || 'Other',
        amount: item.amount,
        percentage,
        count: item.count,
        color: meta.color,
        icon: meta.icon,
      };
    });

    // 5. Daily Spending Trend (over selected range)
    const trendAgg = await Transaction.aggregate([
      {
        $match: {
          user: userId,
          date: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: {
            dateStr: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            type: '$type',
          },
          total: { $sum: '$amount' },
        },
      },
      { $sort: { '_id.dateStr': 1 } },
    ]);

    // Group by date
    const dateMap = {};
    trendAgg.forEach(t => {
      const d = t._id.dateStr;
      if (!dateMap[d]) {
        dateMap[d] = { date: d, income: 0, expense: 0 };
      }
      if (t._id.type === 'income') dateMap[d].income = t.total;
      if (t._id.type === 'expense') dateMap[d].expense = t.total;
    });
    const spendingTrend = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));

    // 6. Monthly Income vs Expense (Last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const monthlyAgg = await Transaction.aggregate([
      {
        $match: {
          user: userId,
          date: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            yearMonth: { $dateToString: { format: '%Y-%m', date: '$date' } },
            type: '$type',
          },
          total: { $sum: '$amount' },
        },
      },
      { $sort: { '_id.yearMonth': 1 } },
    ]);

    const monthlyMap = {};
    monthlyAgg.forEach(m => {
      const ym = m._id.yearMonth;
      if (!monthlyMap[ym]) {
        const [y, mon] = ym.split('-');
        const dateObj = new Date(parseInt(y), parseInt(mon) - 1, 1);
        const label = dateObj.toLocaleString('default', { month: 'short' });
        monthlyMap[ym] = { monthKey: ym, label, income: 0, expense: 0, savings: 0 };
      }
      if (m._id.type === 'income') monthlyMap[ym].income = m.total;
      if (m._id.type === 'expense') monthlyMap[ym].expense = m.total;
      monthlyMap[ym].savings = monthlyMap[ym].income - monthlyMap[ym].expense;
    });
    const incomeVsExpense = Object.values(monthlyMap);

    // 7. Recent Transactions (last 6)
    const recentTransactions = await Transaction.find({ user: userId })
      .populate('category', 'name icon color type')
      .populate('account', 'name type color')
      .sort({ date: -1, createdAt: -1 })
      .limit(6);

    // 8. Generate Smart Financial Insights
    const insights = await generateSmartInsights(userId, startOfCurrentMonth, endOfCurrentMonth, totalIncome, totalExpenses, categoryDistribution, budgetUsagePercent);

    res.json({
      success: true,
      timeframe,
      range: { start, end },
      cards: {
        currentBalance,
        totalIncome,
        totalExpenses,
        remainingBudget,
        monthlyBudget: monthlyBudgetAmount,
        budgetUsagePercent,
      },
      categoryDistribution,
      spendingTrend,
      incomeVsExpense,
      recentTransactions,
      insights,
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to generate smart insights
const generateSmartInsights = async (userId, currentMonthStart, currentMonthEnd, totalIncome, totalExpenses, categoryDistribution, budgetUsagePercent) => {
  const insights = [];

  // 1. Budget usage insight
  if (budgetUsagePercent >= 100) {
    insights.push({
      type: 'critical',
      title: 'Monthly Budget Exceeded',
      text: `You have consumed ${budgetUsagePercent}% of your monthly budget. Consider reviewing non-essential spending.`,
      icon: 'AlertTriangle',
    });
  } else if (budgetUsagePercent >= 80) {
    insights.push({
      type: 'warning',
      title: 'High Budget Usage',
      text: `You are currently using ${budgetUsagePercent}% of your monthly budget. Watch upcoming expenditures.`,
      icon: 'AlertCircle',
    });
  } else {
    insights.push({
      type: 'positive',
      title: 'Budget On Track',
      text: `You are using ${budgetUsagePercent}% of your monthly budget, safely within target.`,
      icon: 'CheckCircle2',
    });
  }

  // 2. Top spending categories insight
  if (categoryDistribution.length > 0) {
    const top1 = categoryDistribution[0];
    insights.push({
      type: 'info',
      title: `Top Spending: ${top1.name}`,
      text: `${top1.name} accounts for ₹${top1.amount.toLocaleString()} (${top1.percentage}% of your expenses).`,
      icon: 'PieChart',
    });

    if (categoryDistribution.length > 1) {
      const top2 = categoryDistribution[1];
      insights.push({
        type: 'info',
        title: `Second Highest: ${top2.name}`,
        text: `${top2.name} is your second-highest expense category at ₹${top2.amount.toLocaleString()}.`,
        icon: 'TrendingUp',
      });
    }
  }

  // 3. Month-over-month comparison for top category (e.g. Food)
  const now = new Date();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const prevMonthCategoryAgg = await Transaction.aggregate([
    {
      $match: {
        user: userId,
        type: 'expense',
        date: { $gte: lastMonthStart, $lte: lastMonthEnd },
      },
    },
    {
      $group: {
        _id: '$categoryName',
        total: { $sum: '$amount' },
      },
    },
  ]);

  if (categoryDistribution.length > 0 && prevMonthCategoryAgg.length > 0) {
    const topCatName = categoryDistribution[0].name;
    const prevCat = prevMonthCategoryAgg.find(p => p._id && p._id.toLowerCase() === topCatName.toLowerCase());
    if (prevCat && prevCat.total > 0) {
      const currentCatSpent = categoryDistribution[0].amount;
      const diffPercent = Math.round(((currentCatSpent - prevCat.total) / prevCat.total) * 100);
      if (diffPercent > 0) {
        insights.push({
          type: 'warning',
          title: `${topCatName} Spending Increased`,
          text: `Your ${topCatName} expenses increased by ${diffPercent}% compared to last month.`,
          icon: 'TrendingUp',
        });
      } else if (diffPercent < 0) {
        insights.push({
          type: 'positive',
          title: `${topCatName} Spending Reduced`,
          text: `Great job! Your ${topCatName} expenses decreased by ${Math.abs(diffPercent)}% compared to last month.`,
          icon: 'TrendingDown',
        });
      }
    }
  }

  // 4. Savings rate insight
  if (totalIncome > 0) {
    const savings = totalIncome - totalExpenses;
    const savingsRate = Math.round(((totalIncome - totalExpenses) / totalIncome) * 100);
    if (savingsRate > 20) {
      insights.push({
        type: 'positive',
        title: `Healthy Savings Rate: ${savingsRate}%`,
        text: `You have saved ₹${savings.toLocaleString()} this period, a solid ${savingsRate}% savings rate.`,
        icon: 'Sparkles',
      });
    } else if (savingsRate > 0) {
      insights.push({
        type: 'info',
        title: `Savings Rate: ${savingsRate}%`,
        text: `Your current net savings is ₹${savings.toLocaleString()} (${savingsRate}% of income).`,
        icon: 'Shield',
      });
    } else {
      insights.push({
        type: 'critical',
        title: 'Negative Cashflow',
        text: `Expenses exceed income by ₹${Math.abs(savings).toLocaleString()} for this timeframe.`,
        icon: 'AlertTriangle',
      });
    }
  }

  // 5. Average Daily spending
  const daysInPeriod = Math.max(1, Math.ceil((currentMonthEnd - currentMonthStart) / (1000 * 60 * 60 * 24)));
  const avgDaily = Math.round(totalExpenses / daysInPeriod);
  if (avgDaily > 0) {
    insights.push({
      type: 'info',
      title: 'Average Daily Spending',
      text: `Your average daily spending is approx ₹${avgDaily.toLocaleString()} per day.`,
      icon: 'Calendar',
    });
  }

  return insights.slice(0, 5);
};

// @desc    Get detailed Reports & Analytics
// @route   GET /api/analytics/reports
// @access  Private
const getReportsAndAnalytics = async (req, res, next) => {
  try {
    const { timeframe = 'this_month', customStart, customEnd } = req.query;
    const { start, end } = getDateRange(timeframe, customStart, customEnd);
    const userId = req.user._id;

    // 1. Overall Income vs Expense in timeframe
    const overallAgg = await Transaction.aggregate([
      {
        $match: {
          user: userId,
          date: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    let totalIncome = 0;
    let totalExpenses = 0;
    overallAgg.forEach(i => {
      if (i._id === 'income') totalIncome = i.total;
      if (i._id === 'expense') totalExpenses = i.total;
    });

    const netSavings = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? Number((((totalIncome - totalExpenses) / totalIncome) * 100).toFixed(1)) : 0;

    // 2. Average Daily Spending in timeframe
    const msDiff = Math.abs(end - start);
    const numDays = Math.max(1, Math.ceil(msDiff / (1000 * 60 * 60 * 24)));
    const avgDailySpending = Math.round(totalExpenses / numDays);

    // 3. Top Spending Categories
    const topCategoriesAgg = await Transaction.aggregate([
      {
        $match: {
          user: userId,
          type: 'expense',
          date: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: '$categoryName',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 8 },
    ]);

    // 4. Highest Individual Transactions
    const highestTransactions = await Transaction.find({
      user: userId,
      type: 'expense',
      date: { $gte: start, $lte: end },
    })
      .sort({ amount: -1 })
      .limit(5)
      .populate('category', 'name icon color')
      .populate('account', 'name type');

    // 5. Monthly breakdown for past 12 months
    const oneYearAgo = new Date();
    oneYearAgo.setMonth(oneYearAgo.getMonth() - 11);
    oneYearAgo.setDate(1);

    const monthlyBreakdownAgg = await Transaction.aggregate([
      {
        $match: {
          user: userId,
          date: { $gte: oneYearAgo },
        },
      },
      {
        $group: {
          _id: {
            yearMonth: { $dateToString: { format: '%Y-%m', date: '$date' } },
            type: '$type',
          },
          total: { $sum: '$amount' },
        },
      },
      { $sort: { '_id.yearMonth': 1 } },
    ]);

    const monthlyHistoryMap = {};
    let sumMonthlyExpenses = 0;
    let monthCount = 0;

    monthlyBreakdownAgg.forEach(m => {
      const ym = m._id.yearMonth;
      if (!monthlyHistoryMap[ym]) {
        const [y, mon] = ym.split('-');
        const d = new Date(parseInt(y), parseInt(mon) - 1, 1);
        monthlyHistoryMap[ym] = {
          month: ym,
          label: d.toLocaleString('default', { month: 'short', year: '2-digit' }),
          income: 0,
          expense: 0,
          savings: 0,
        };
        monthCount++;
      }
      if (m._id.type === 'income') monthlyHistoryMap[ym].income = m.total;
      if (m._id.type === 'expense') {
        monthlyHistoryMap[ym].expense = m.total;
        sumMonthlyExpenses += m.total;
      }
      monthlyHistoryMap[ym].savings = monthlyHistoryMap[ym].income - monthlyHistoryMap[ym].expense;
    });

    const monthlyHistory = Object.values(monthlyHistoryMap);
    const avgMonthlySpending = monthCount > 0 ? Math.round(sumMonthlyExpenses / monthCount) : totalExpenses;

    res.json({
      success: true,
      timeframe,
      range: { start, end },
      summary: {
        totalIncome,
        totalExpenses,
        netSavings,
        savingsRate,
        avgDailySpending,
        avgMonthlySpending,
      },
      topCategories: topCategoriesAgg.map(c => ({
        name: c._id || 'Uncategorized',
        amount: c.total,
        count: c.count,
        percentage: totalExpenses > 0 ? Math.round((c.total / totalExpenses) * 100) : 0,
      })),
      highestTransactions,
      monthlyHistory,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Monthly Summary (November 2026, etc.)
// @route   GET /api/analytics/monthly-summary
// @access  Private
const getMonthlySummary = async (req, res, next) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month, 10) || now.getMonth() + 1;
    const year = parseInt(req.query.year, 10) || now.getFullYear();

    const start = new Date(year, month - 1, 1, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59);

    const prevStart = new Date(year, month - 2, 1, 0, 0, 0);
    const prevEnd = new Date(year, month - 1, 0, 23, 59, 59);

    // Current month stats
    const currentAgg = await Transaction.aggregate([
      {
        $match: {
          user: req.user._id,
          date: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
        },
      },
    ]);

    let income = 0;
    let expenses = 0;
    currentAgg.forEach(i => {
      if (i._id === 'income') income = i.total;
      if (i._id === 'expense') expenses = i.total;
    });

    // Previous month stats
    const prevAgg = await Transaction.aggregate([
      {
        $match: {
          user: req.user._id,
          date: { $gte: prevStart, $lte: prevEnd },
        },
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
        },
      },
    ]);

    let prevIncome = 0;
    let prevExpenses = 0;
    prevAgg.forEach(i => {
      if (i._id === 'income') prevIncome = i.total;
      if (i._id === 'expense') prevExpenses = i.total;
    });

    const savings = income - expenses;
    const savingsRate = income > 0 ? Number((((income - expenses) / income) * 100).toFixed(1)) : 0;

    // Top Category
    const topCatAgg = await Transaction.aggregate([
      {
        $match: {
          user: req.user._id,
          type: 'expense',
          date: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: '$categoryName',
          total: { $sum: '$amount' },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 1 },
    ]);

    const topCategory = topCatAgg[0] ? { name: topCatAgg[0]._id, amount: topCatAgg[0].total } : null;

    // Highest single transaction
    const highestTx = await Transaction.findOne({
      user: req.user._id,
      type: 'expense',
      date: { $gte: start, $lte: end },
    }).sort({ amount: -1 });

    const monthName = start.toLocaleString('default', { month: 'long' });

    res.json({
      success: true,
      month,
      year,
      monthName: `${monthName} ${year}`,
      summary: {
        income,
        expenses,
        savings,
        savingsRate,
        topCategory,
        highestTransaction: highestTx
          ? {
              description: highestTx.description,
              amount: highestTx.amount,
              date: highestTx.date,
              categoryName: highestTx.categoryName,
            }
          : null,
      },
      comparison: {
        prevIncome,
        prevExpenses,
        incomeChangePercent: prevIncome > 0 ? Number((((income - prevIncome) / prevIncome) * 100).toFixed(1)) : 0,
        expenseChangePercent: prevExpenses > 0 ? Number((((expenses - prevExpenses) / prevExpenses) * 100).toFixed(1)) : 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardData,
  getReportsAndAnalytics,
  getMonthlySummary,
};
