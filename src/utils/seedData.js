const Category = require('../models/Category');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const RecurringTransaction = require('../models/RecurringTransaction');
const Notification = require('../models/Notification');

const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Food', icon: 'Utensils', color: '#EF4444', monthlyBudget: 6000 },
  { name: 'Groceries', icon: 'ShoppingBag', color: '#F97316', monthlyBudget: 5000 },
  { name: 'Transportation', icon: 'Car', color: '#F59E0B', monthlyBudget: 3500 },
  { name: 'Shopping', icon: 'Sparkles', color: '#EC4899', monthlyBudget: 4000 },
  { name: 'Bills', icon: 'FileText', color: '#8B5CF6', monthlyBudget: 3000 },
  { name: 'Rent', icon: 'Home', color: '#6366F1', monthlyBudget: 15000 },
  { name: 'Entertainment', icon: 'Film', color: '#3B82F6', monthlyBudget: 2500 },
  { name: 'Health', icon: 'HeartPulse', color: '#10B981', monthlyBudget: 2000 },
  { name: 'Education', icon: 'GraduationCap', color: '#14B8A6', monthlyBudget: 1500 },
  { name: 'Travel', icon: 'Plane', color: '#06B6D4', monthlyBudget: 5000 },
  { name: 'Subscriptions', icon: 'Tv', color: '#A855F7', monthlyBudget: 1200 },
  { name: 'Personal Care', icon: 'Smile', color: '#D946EF', monthlyBudget: 1500 },
  { name: 'Electronics', icon: 'Laptop', color: '#64748B', monthlyBudget: 4000 },
  { name: 'Gifts', icon: 'Gift', color: '#E11D48', monthlyBudget: 2000 },
  { name: 'Other', icon: 'MoreHorizontal', color: '#6B7280', monthlyBudget: 1000 },
];

const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Salary', icon: 'Briefcase', color: '#10B981' },
  { name: 'Freelance', icon: 'Laptop', color: '#059669' },
  { name: 'Business', icon: 'TrendingUp', color: '#047857' },
  { name: 'Investment', icon: 'LineChart', color: '#3B82F6' },
  { name: 'Bonus', icon: 'Award', color: '#F59E0B' },
  { name: 'Gift', icon: 'Gift', color: '#EC4899' },
  { name: 'Other', icon: 'PlusCircle', color: '#6B7280' },
];

const DEFAULT_ACCOUNTS = [
  { name: 'HDFC Bank', type: 'Bank', balance: 45250, initialBalance: 25000, color: '#3B82F6', icon: 'Landmark', isDefault: true },
  { name: 'Cash Wallet', type: 'Cash', balance: 4250, initialBalance: 5000, color: '#10B981', icon: 'Wallet' },
  { name: 'Google Pay (UPI)', type: 'UPI', balance: 2150, initialBalance: 3000, color: '#6366F1', icon: 'Smartphone' },
  { name: 'ICICI Credit Card', type: 'Credit Card', balance: -8500, initialBalance: 0, color: '#F43F5E', icon: 'CreditCard' },
];

const seedUserData = async (userId, userName) => {
  try {
    // 1. Seed Categories
    const categoriesToCreate = [
      ...DEFAULT_EXPENSE_CATEGORIES.map(c => ({ ...c, user: userId, type: 'expense', isDefault: true })),
      ...DEFAULT_INCOME_CATEGORIES.map(c => ({ ...c, user: userId, type: 'income', isDefault: true })),
    ];
    const createdCategories = await Category.insertMany(categoriesToCreate);

    // 2. Seed Accounts
    const accountsToCreate = DEFAULT_ACCOUNTS.map(a => ({ ...a, user: userId }));
    const createdAccounts = await Account.insertMany(accountsToCreate);

    const bankAccount = createdAccounts.find(a => a.name === 'HDFC Bank') || createdAccounts[0];
    const cashAccount = createdAccounts.find(a => a.name === 'Cash Wallet') || createdAccounts[1];
    const upiAccount = createdAccounts.find(a => a.name === 'Google Pay (UPI)') || createdAccounts[2];

    const foodCat = createdCategories.find(c => c.name === 'Food');
    const salaryCat = createdCategories.find(c => c.name === 'Salary');
    const rentCat = createdCategories.find(c => c.name === 'Rent');
    const transportCat = createdCategories.find(c => c.name === 'Transportation');
    const shoppingCat = createdCategories.find(c => c.name === 'Shopping');
    const billsCat = createdCategories.find(c => c.name === 'Bills');
    const entertainmentCat = createdCategories.find(c => c.name === 'Entertainment');
    const freelanceCat = createdCategories.find(c => c.name === 'Freelance');
    const subCat = createdCategories.find(c => c.name === 'Subscriptions');

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12

    // 3. Seed Monthly Budget
    await Budget.create({
      user: userId,
      month: currentMonth,
      year: currentYear,
      overallBudget: 35000,
      categoryBudgets: [
        { category: foodCat._id, categoryName: 'Food', amount: 6000 },
        { category: shoppingCat._id, categoryName: 'Shopping', amount: 4000 },
        { category: transportCat._id, categoryName: 'Transportation', amount: 3500 },
        { category: billsCat._id, categoryName: 'Bills', amount: 3000 },
        { category: entertainmentCat._id, categoryName: 'Entertainment', amount: 2500 },
      ],
    });

    // 4. Seed Recurring Transactions
    const recurringData = [
      {
        user: userId,
        name: 'Netflix Subscription',
        amount: 649,
        type: 'expense',
        category: subCat._id,
        categoryName: 'Subscriptions',
        account: bankAccount._id,
        accountName: bankAccount.name,
        frequency: 'monthly',
        startDate: new Date(currentYear, now.getMonth(), 5),
        nextOccurrence: new Date(currentYear, now.getMonth(), 5),
        notes: 'Monthly 4K plan',
      },
      {
        user: userId,
        name: 'Apartment Rent',
        amount: 15000,
        type: 'expense',
        category: rentCat._id,
        categoryName: 'Rent',
        account: bankAccount._id,
        accountName: bankAccount.name,
        frequency: 'monthly',
        startDate: new Date(currentYear, now.getMonth(), 1),
        nextOccurrence: new Date(currentYear, now.getMonth(), 1),
        notes: 'Monthly flat rent',
      },
      {
        user: userId,
        name: 'Monthly Salary',
        amount: 65000,
        type: 'income',
        category: salaryCat._id,
        categoryName: 'Salary',
        account: bankAccount._id,
        accountName: bankAccount.name,
        frequency: 'monthly',
        startDate: new Date(currentYear, now.getMonth(), 1),
        nextOccurrence: new Date(currentYear, now.getMonth() + 1, 1),
        notes: 'Main employment salary',
      },
      {
        user: userId,
        name: 'Spotify Premium',
        amount: 119,
        type: 'expense',
        category: subCat._id,
        categoryName: 'Subscriptions',
        account: upiAccount._id,
        accountName: upiAccount.name,
        frequency: 'monthly',
        startDate: new Date(currentYear, now.getMonth(), 12),
        nextOccurrence: new Date(currentYear, now.getMonth(), 12),
        notes: 'Individual plan',
      },
    ];
    await RecurringTransaction.insertMany(recurringData);

    // 5. Seed Realistic Sample Transactions across current and previous weeks
    const daysAgo = (days) => {
      const d = new Date();
      d.setDate(d.getDate() - days);
      return d;
    };

    const sampleTransactions = [
      {
        user: userId,
        type: 'income',
        amount: 65000,
        description: 'Monthly Salary Credit',
        category: salaryCat._id,
        categoryName: 'Salary',
        account: bankAccount._id,
        accountName: bankAccount.name,
        date: daysAgo(1),
        paymentMethod: 'NetBanking',
        notes: 'Direct employer deposit',
      },
      {
        user: userId,
        type: 'expense',
        amount: 15000,
        description: 'Apartment Rent Payment',
        category: rentCat._id,
        categoryName: 'Rent',
        account: bankAccount._id,
        accountName: bankAccount.name,
        date: daysAgo(1),
        paymentMethod: 'NetBanking',
        notes: 'House maintenance included',
      },
      {
        user: userId,
        type: 'expense',
        amount: 250,
        description: 'Lunch with colleagues',
        category: foodCat._id,
        categoryName: 'Food',
        account: cashAccount._id,
        accountName: cashAccount.name,
        date: daysAgo(0),
        paymentMethod: 'Cash',
        notes: 'Thali meal',
      },
      {
        user: userId,
        type: 'expense',
        amount: 180,
        description: 'Uber ride to office',
        category: transportCat._id,
        categoryName: 'Transportation',
        account: upiAccount._id,
        accountName: upiAccount.name,
        date: daysAgo(0),
        paymentMethod: 'UPI',
        notes: 'Morning rush hour',
      },
      {
        user: userId,
        type: 'expense',
        amount: 1450,
        description: 'Supermarket weekly groceries',
        category: createdCategories.find(c => c.name === 'Groceries')._id,
        categoryName: 'Groceries',
        account: upiAccount._id,
        accountName: upiAccount.name,
        date: daysAgo(2),
        paymentMethod: 'UPI',
        notes: 'Fresh veggies and pantry staples',
      },
      {
        user: userId,
        type: 'income',
        amount: 12000,
        description: 'Frontend consulting freelance project',
        category: freelanceCat._id,
        categoryName: 'Freelance',
        account: bankAccount._id,
        accountName: bankAccount.name,
        date: daysAgo(3),
        paymentMethod: 'NetBanking',
        notes: 'Milestone 1 payment',
      },
      {
        user: userId,
        type: 'expense',
        amount: 1250,
        description: 'Electricity & Water Bill',
        category: billsCat._id,
        categoryName: 'Bills',
        account: upiAccount._id,
        accountName: upiAccount.name,
        date: daysAgo(4),
        paymentMethod: 'UPI',
        notes: 'Monthly power board bill',
      },
      {
        user: userId,
        type: 'expense',
        amount: 3250,
        description: 'Weekend Mall Shopping',
        category: shoppingCat._id,
        categoryName: 'Shopping',
        account: bankAccount._id,
        accountName: bankAccount.name,
        date: daysAgo(5),
        paymentMethod: 'Debit Card',
        notes: 'Clothing sale purchase',
      },
      {
        user: userId,
        type: 'expense',
        amount: 720,
        description: 'Movie tickets & popcorn',
        category: entertainmentCat._id,
        categoryName: 'Entertainment',
        account: upiAccount._id,
        accountName: upiAccount.name,
        date: daysAgo(6),
        paymentMethod: 'UPI',
        notes: 'IMAX weekend show',
      },
      {
        user: userId,
        type: 'expense',
        amount: 540,
        description: 'Dinner delivery Swiggy',
        category: foodCat._id,
        categoryName: 'Food',
        account: upiAccount._id,
        accountName: upiAccount.name,
        date: daysAgo(7),
        paymentMethod: 'UPI',
        notes: 'Pizza night',
      },
      {
        user: userId,
        type: 'expense',
        amount: 320,
        description: 'Metro card recharge',
        category: transportCat._id,
        categoryName: 'Transportation',
        account: upiAccount._id,
        accountName: upiAccount.name,
        date: daysAgo(8),
        paymentMethod: 'UPI',
      },
      {
        user: userId,
        type: 'expense',
        amount: 649,
        description: 'Netflix 4K Premium',
        category: subCat._id,
        categoryName: 'Subscriptions',
        account: bankAccount._id,
        accountName: bankAccount.name,
        date: daysAgo(10),
        paymentMethod: 'Credit Card',
        isRecurring: true,
      },
    ];
    await Transaction.insertMany(sampleTransactions);

    // 6. Seed Notifications
    const sampleNotifications = [
      {
        user: userId,
        title: 'Welcome to Jathu Expense Tracker!',
        message: 'Your personal finance workspace is ready. Track income, expenses, budgets, and wallets seamlessly.',
        type: 'general',
        isRead: false,
      },
      {
        user: userId,
        title: 'Upcoming Bill: Netflix Subscription',
        message: '₹649 will be charged to your HDFC Bank account soon.',
        type: 'recurring_due',
        isRead: false,
      },
      {
        user: userId,
        title: 'Budget Alert: Food Category',
        message: 'You have spent 70% of your ₹6,000 Food budget for this month.',
        type: 'budget_warning',
        isRead: false,
      },
    ];
    await Notification.insertMany(sampleNotifications);

    console.log(`Successfully seeded initial data for user: ${userName}`);
  } catch (error) {
    console.error('Error seeding user data:', error);
  }
};

module.exports = {
  seedUserData,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  DEFAULT_ACCOUNTS,
};
