const express = require('express');
const router = express.Router();
const {
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  importTransactions,
} = require('../controllers/transactionController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(protect);

router.post('/import', importTransactions);

router.route('/')
  .get(getTransactions)
  .post(upload.single('attachment'), createTransaction);

router.route('/:id')
  .get(getTransactionById)
  .put(upload.single('attachment'), updateTransaction)
  .delete(deleteTransaction);

module.exports = router;
