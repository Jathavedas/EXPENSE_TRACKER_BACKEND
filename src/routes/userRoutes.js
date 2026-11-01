const express = require('express');
const router = express.Router();
const {
  exportAllData,
  resetUserData,
  deleteAccount,
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/export-all', exportAllData);
router.post('/reset-data', resetUserData);
router.delete('/account', deleteAccount);

module.exports = router;
