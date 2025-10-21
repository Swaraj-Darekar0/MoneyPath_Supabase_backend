const express = require('express');
const { getDashboardData } = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Protect the route with the auth middleware
router.get('/', authMiddleware, getDashboardData);

module.exports = router;