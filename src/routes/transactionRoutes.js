const express = require('express');
const { createTransaction } = require('../controllers/transactionController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Protect all transaction routes
router.use(authMiddleware);

router.post('/', createTransaction);

module.exports = router;