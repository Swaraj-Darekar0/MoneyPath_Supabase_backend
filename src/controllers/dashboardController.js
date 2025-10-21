const supabase = require('../config/supabaseClient');

const getDashboardData = async (req, res) => {
  const userId = req.user.id;

  try {
    // Fetch profile, goals, and transactions in parallel
    const [profileRes, goalsRes, transactionsRes] = await Promise.all([
      supabase.from('profiles').select('id, total_balance, daily_spending_buffer, daily_savings_target').eq('id', userId).single(),
      supabase.from('goals').select('id, name, description, target_amount, saved_amount, target_date, category:categories(name)').eq('user_id', userId),
      supabase.from('transactions').select('id, amount, note, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(20)
    ]);

    if (profileRes.error) throw profileRes.error;
    if (goalsRes.error) throw goalsRes.error;
    if (transactionsRes.error) throw transactionsRes.error;

    // Format goals to match the API spec
    const formattedGoals = goalsRes.data.map(goal => ({
      ...goal,
      category: goal.category ? goal.category.name : null
    }));

    res.status(200).json({
      profile: profileRes.data,
      goals: formattedGoals,
      transactions: transactionsRes.data,
    });

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data.' });
  }
};

module.exports = { getDashboardData };