const express = require('express');
const { createGoal, getGoals } = require('../controllers/goalController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Protect all goal routes
router.use(authMiddleware);

router.post('/', createGoal);
router.get('/', getGoals);

module.exports = router;