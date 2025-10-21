const express = require('express');
const { getCategories } = require('../controllers/goalController');

const router = express.Router();

// This endpoint is public and does not need auth
router.get('/', getCategories);

module.exports = router;