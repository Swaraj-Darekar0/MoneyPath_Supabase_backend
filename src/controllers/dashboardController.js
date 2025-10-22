const supabase = require('../config/supabaseClient');

const getDashboardData = async (req, res) => {
  const userId = req.user.id; // User ID from authMiddleware

  try {
    // Fetch Profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, total_balance, daily_spending_buffer, daily_savings_target, buffer_status, buffer_days, average_daily_expenses, average_daily_income, today_income, today_expenses, overspending_recovery, surplus_allocation')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return res.status(500).json({ error: profileError.message });
    }

    // Fetch Goals
    const { data: goals, error: goalsError } = await supabase
      .from('goals')
      .select('id, name, description, target_amount, saved_amount, category_id, target_date, status, days_offset, status_message, categories(name, weight)')
      .eq('user_id', userId);

    if (goalsError) {
      console.error('Error fetching goals:', goalsError);
      return res.status(500).json({ error: goalsError.message });
    }

    // Map goals to include category name and weight directly
    const formattedGoals = goals.map(goal => ({
      ...goal,
      category: goal.categories.name,
      category_weight: goal.categories.weight,
      category_id: undefined, // Remove category_id from the top level
      categories: undefined, // Remove the nested categories object
    }));

    // Fetch Transactions
    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('id, amount, note, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10); // Limit to 10 most recent transactions

    if (transactionsError) {
      console.error('Error fetching transactions:', transactionsError);
      return res.status(500).json({ error: transactionsError.message });
    }

    res.status(200).json({
      profile,
      goals: formattedGoals,
      transactions,
    });

  } catch (error) {
    console.error('Internal server error in getDashboardData:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { getDashboardData };
