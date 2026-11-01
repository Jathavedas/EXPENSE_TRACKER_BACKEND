const express = require('express');
const router = express.Router();
const {
  getDashboardData,
  getReportsAndAnalytics,
  getMonthlySummary,
} = require('../controllers/analyticsController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/dashboard', getDashboardData);
router.get('/reports', getReportsAndAnalytics);
router.get('/monthly-summary', getMonthlySummary);

module.exports = router;
