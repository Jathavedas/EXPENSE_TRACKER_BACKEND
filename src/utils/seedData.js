const Category = require('../models/Category');
const Account = require('../models/Account');
const Notification = require('../models/Notification');

const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Food & Dining', icon: 'Utensils', color: '#EF4444' },
  { name: 'Groceries', icon: 'ShoppingBag', color: '#F97316' },
  { name: 'Transportation', icon: 'Car', color: '#F59E0B' },
  { name: 'Shopping', icon: 'Sparkles', color: '#EC4899' },
  { name: 'Bills & Utilities', icon: 'FileText', color: '#8B5CF6' },
  { name: 'Housing & Rent', icon: 'Home', color: '#6366F1' },
  { name: 'Entertainment', icon: 'Film', color: '#3B82F6' },
  { name: 'Health & Medical', icon: 'HeartPulse', color: '#10B981' },
  { name: 'Education', icon: 'GraduationCap', color: '#14B8A6' },
  { name: 'Travel', icon: 'Plane', color: '#06B6D4' },
  { name: 'Subscriptions', icon: 'Tv', color: '#A855F7' },
  { name: 'Personal Care', icon: 'Smile', color: '#D946EF' },
  { name: 'Electronics', icon: 'Laptop', color: '#64748B' },
  { name: 'Gifts & Donations', icon: 'Gift', color: '#E11D48' },
  { name: 'Investments', icon: 'TrendingUp', color: '#059669' },
  { name: 'Other Expense', icon: 'MoreHorizontal', color: '#6B7280' },
];

const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Salary', icon: 'Briefcase', color: '#10B981' },
  { name: 'Freelance & Projects', icon: 'Laptop', color: '#059669' },
  { name: 'Business Income', icon: 'TrendingUp', color: '#047857' },
  { name: 'Investments & Dividends', icon: 'LineChart', color: '#3B82F6' },
  { name: 'Rental Income', icon: 'Home', color: '#6366F1' },
  { name: 'Bonus & Incentives', icon: 'Award', color: '#F59E0B' },
  { name: 'Gifts & Grants', icon: 'Gift', color: '#EC4899' },
  { name: 'Other Income', icon: 'PlusCircle', color: '#6B7280' },
];

// Clean starter accounts with 0 balance (no dummy balances)
const DEFAULT_ACCOUNTS = [
  { name: 'Primary Bank', type: 'Bank', balance: 0, initialBalance: 0, color: '#3B82F6', icon: 'Landmark', isDefault: true },
  { name: 'Cash Wallet', type: 'Cash', balance: 0, initialBalance: 0, color: '#10B981', icon: 'Wallet' },
  { name: 'UPI', type: 'UPI', balance: 0, initialBalance: 0, color: '#6366F1', icon: 'Smartphone' },
];

/**
 * Initializes a clean account for a newly created user with essential structure only.
 * Strictly NO dummy transactions, NO fake budgets, and NO mock recurring expenses.
 */
const seedUserData = async (userId, userName) => {
  try {
    // 1. Initialize Clean Default Categories
    const categoriesToCreate = [
      ...DEFAULT_EXPENSE_CATEGORIES.map(c => ({ ...c, user: userId, type: 'expense', isDefault: true })),
      ...DEFAULT_INCOME_CATEGORIES.map(c => ({ ...c, user: userId, type: 'income', isDefault: true })),
    ];
    await Category.insertMany(categoriesToCreate);

    // 2. Initialize Clean Starter Accounts (0 Balance)
    const accountsToCreate = DEFAULT_ACCOUNTS.map(a => ({ ...a, user: userId }));
    await Account.insertMany(accountsToCreate);

    // 3. Welcome Notification only
    await Notification.create({
      user: userId,
      title: 'Welcome to Jathu Expense Tracker!',
      message: 'Your personal finance workspace is clean and ready. Add your real accounts and transactions whenever you are ready.',
      type: 'general',
      isRead: false,
    });

    console.log(`Clean workspace initialized for user: ${userName} (0 dummy transactions).`);
  } catch (error) {
    console.error('Error initializing user workspace:', error);
  }
};

module.exports = {
  seedUserData,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  DEFAULT_ACCOUNTS,
};
