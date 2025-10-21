const goalService = require('../services/goalService');

// Corresponds to POST /api/goals
const createGoal = async (req, res) => {
  const userId = req.user.id;
  const { name, description, target_amount, duration, category } = req.body;

  if (!name || !target_amount || !duration || !category) {
    return res.status(400).json({ error: 'Missing required fields: name, target_amount, duration, category' });
  }

  // Convert duration (in days) to a target_date
  const target_date = new Date();
  target_date.setDate(target_date.getDate() + parseInt(duration, 10));

  const goalData = { name, description, target_amount, target_date, category };

  try {
    const newGoal = await goalService.createGoal(require('../config/supabaseClient'), userId, goalData);
    res.status(201).json(newGoal);
  } catch (error) {
    console.error('Error in goalController.createGoal:', error);
    res.status(500).json({ error: error.message });
  }
};

// Corresponds to GET /api/goals
const getGoals = async (req, res) => {
    const userId = req.user.id;
    try {
        const goals = await goalService.getGoals(require('../config/supabaseClient'), userId);
        res.status(200).json(goals);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get goals.' });
    }
};


// Corresponds to GET /api/categories
const getCategories = async (req, res) => {
    try {
        const categories = await goalService.getCategories(require('../config/supabaseClient'));
        res.status(200).json(categories);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get categories.' });
    }
};

module.exports = {
  createGoal,
  getGoals,
  getCategories,
};