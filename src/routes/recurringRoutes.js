const express = require('express');
const router = express.Router();
const {
  getRecurring,
  createRecurring,
  processRecurringNow,
  updateRecurring,
  deleteRecurring,
} = require('../controllers/recurringController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/')
  .get(getRecurring)
  .post(createRecurring);

router.post('/:id/process', processRecurringNow);

router.route('/:id')
  .put(updateRecurring)
  .delete(deleteRecurring);

module.exports = router;
