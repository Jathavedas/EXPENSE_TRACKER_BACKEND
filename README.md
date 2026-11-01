# EXPENSE_TRACKER_BACKEND

Production-grade Express.js & MongoDB REST API backend for the **Jathu Personal Expense & Wealth Management** system.

## 🚀 Features

- **Authentication & Security**: JWT Authentication, bcrypt password hashing, secure auth middleware.
- **Transactions Management**: Complete CRUD with filtering, date ranges, categorization, account linkage, and CSV/PDF export support.
- **Multi-Account Support**: Bank accounts, Cash Wallets, UPI, and Credit Cards with real-time balance calculations.
- **Budgeting Engine**: Monthly budgets, threshold notifications, category limits, and spending health indicators.
- **Recurring Transactions**: Subscriptions, utility bills, rent, and recurring income tracking.
- **Analytics & Insights**: Monthly aggregations, category breakdowns, daily burn rates, and financial advice engine.
- **Notifications**: Automated budget overrun alerts, bill due reminders, and transaction alerts.

## 🛠️ Tech Stack

- **Node.js** & **Express.js**
- **MongoDB** with **Mongoose**
- **JWT (jsonwebtoken)** & **bcryptjs**
- **Multer** for file handling
- **json2csv** & **pdfkit** for reporting

## ⚙️ Environment Variables

Create a `.env` file in the root directory:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/jathu_expense_tracker
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRE=30d
NODE_ENV=development
CLIENT_URL=http://localhost:5173
```

## 📦 Installation & Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   # or
   node --watch src/server.js
   ```

3. Seed / Setup initial user:
   ```bash
   node src/utils/setupUser.js
   ```

## 📡 API Endpoints

- `POST /api/auth/register` - Create new user account
- `POST /api/auth/login` - Authenticate user & retrieve JWT
- `GET /api/auth/me` - Get current authenticated user profile
- `GET /api/transactions` - Fetch user transactions with filters
- `POST /api/transactions` - Record income or expense
- `GET /api/accounts` - Retrieve all financial accounts & balances
- `GET /api/budgets` - Monthly budget analysis & category progress
- `GET /api/recurring` - Recurring bills & automated subscriptions
- `GET /api/reports/analytics` - Deep analytical charts & financial statistics
