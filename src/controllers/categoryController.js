const Category = require('../models/Category');
const Transaction = require('../models/Transaction');

// @desc    Get all categories for user
// @route   GET /api/categories
// @access  Private
const getCategories = async (req, res, next) => {
  try {
    const { type } = req.query;
    const filter = { user: req.user.id };
    if (type) {
      filter.type = type;
    }

    const categories = await Category.find(filter).sort({ type: 1, name: 1 });

    // Calculate spent/income totals per category for current month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const categoryStats = await Transaction.aggregate([
      {
        $match: {
          user: req.user._id,
          date: { $gte: startOfMonth },
        },
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const statsMap = {};
    categoryStats.forEach(stat => {
      if (stat._id) {
        statsMap[stat._id.toString()] = {
          currentMonthTotal: stat.total,
          count: stat.count,
        };
      }
    });

    const enriched = categories.map(cat => {
      const catObj = cat.toObject();
      const stat = statsMap[cat._id.toString()] || { currentMonthTotal: 0, count: 0 };
      catObj.currentMonthTotal = stat.currentMonthTotal;
      catObj.transactionCount = stat.count;
      return catObj;
    });

    res.json({
      success: true,
      count: enriched.length,
      categories: enriched,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create category
// @route   POST /api/categories
// @access  Private
const createCategory = async (req, res, next) => {
  try {
    const { name, type, icon, color, monthlyBudget } = req.body;

    if (!name || !type) {
      return res.status(400).json({ success: false, message: 'Category name and type are required' });
    }

    const existing = await Category.findOne({
      user: req.user.id,
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      type,
    });

    if (existing) {
      return res.status(400).json({ success: false, message: `Category '${name}' already exists for ${type}` });
    }

    const category = await Category.create({
      user: req.user.id,
      name: name.trim(),
      type,
      icon: icon || (type === 'expense' ? 'Tag' : 'TrendingUp'),
      color: color || '#6366F1',
      monthlyBudget: Number(monthlyBudget || 0),
    });

    res.status(201).json({
      success: true,
      category,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Private
const updateCategory = async (req, res, next) => {
  try {
    const { name, icon, color, monthlyBudget } = req.body;

    const category = await Category.findOne({ _id: req.params.id, user: req.user.id });
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    if (name) category.name = name.trim();
    if (icon) category.icon = icon;
    if (color) category.color = color;
    if (monthlyBudget !== undefined) category.monthlyBudget = Number(monthlyBudget);

    await category.save();

    // If name changed, update cached categoryName in transactions
    if (name) {
      await Transaction.updateMany(
        { user: req.user.id, category: category._id },
        { categoryName: name.trim() }
      );
    }

    res.json({
      success: true,
      category,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete category (safe deletion protection)
// @route   DELETE /api/categories/:id
// @access  Private
const deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findOne({ _id: req.params.id, user: req.user.id });
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const txCount = await Transaction.countDocuments({ user: req.user.id, category: req.params.id });
    if (txCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category '${category.name}' because ${txCount} transaction(s) belong to it. Please reassign or delete those transactions first.`,
      });
    }

    await Category.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
