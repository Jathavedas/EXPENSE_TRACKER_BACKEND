require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Account = require('../models/Account');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const RecurringTransaction = require('../models/RecurringTransaction');
const Notification = require('../models/Notification');
const { seedUserData } = require('./seedData');

const setup = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/jathu_expense_tracker';
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected successfully');

    // 1. Remove demo user if present
    const demoUser = await User.findOne({ email: 'demo@jathuexpense.com' });
    if (demoUser) {
      console.log('Removing old demo user and its data...');
      await Promise.all([
        Account.deleteMany({ user: demoUser._id }),
        Category.deleteMany({ user: demoUser._id }),
        Transaction.deleteMany({ user: demoUser._id }),
        Budget.deleteMany({ user: demoUser._id }),
        RecurringTransaction.deleteMany({ user: demoUser._id }),
        Notification.deleteMany({ user: demoUser._id }),
        User.deleteOne({ _id: demoUser._id }),
      ]);
      console.log('Demo user removed cleanly.');
    }

    // 2. Setup user: Jathavedas
    const targetEmail = 'jathavedaskavikumar@gmail.com'.toLowerCase();
    const targetPassword = 'Jathu@89211';
    const targetName = 'Jathavedas';

    let user = await User.findOne({ email: targetEmail });
    if (!user) {
      console.log(`Creating user ${targetEmail}...`);
      user = new User({
        name: targetName,
        email: targetEmail,
        password: targetPassword,
        currency: 'INR',
        currencySymbol: '₹',
        theme: 'dark',
        monthlyBudget: 35000,
      });
      await user.save();
      console.log(`User created with ID: ${user._id}`);

      // Seed starter categories, accounts, budget, transactions
      console.log('Seeding starter accounts, categories, budgets, and transactions...');
      await seedUserData(user._id, user.name);
      console.log('User data seeded successfully.');
    } else {
      console.log(`User ${targetEmail} exists. Updating password...`);
      user.password = targetPassword;
      user.name = targetName;
      await user.save();
      console.log('Password updated successfully.');

      // Check if accounts exist, if not, seed
      const accountCount = await Account.countDocuments({ user: user._id });
      if (accountCount === 0) {
        console.log('No accounts found for user. Seeding data...');
        await seedUserData(user._id, user.name);
        console.log('Data seeded.');
      }
    }

    console.log('\n=============================================');
    console.log('✅ USER SETUP COMPLETE:');
    console.log(`   Email:    ${targetEmail}`);
    console.log(`   Password: ${targetPassword}`);
    console.log('=============================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  }
};

setup();
