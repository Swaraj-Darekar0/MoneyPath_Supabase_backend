// Mbackend/src/services/financialEngine.js

/**
 * Implements the more advanced daily spending buffer calculation.
 * @param {object} profile - The user's full profile object, including today_income.
 * @param {number} dailySavingTarget - The user's calculated daily saving target.
 * @param {Array} goals - The user's active goals.
 * @returns {number} The calculated daily spending buffer.
 */
function calculateDailySpendingBuffer(profile, dailySavingTarget, goals) {
    // Method 1: Based on Today's Income (Immediate)
    const todayAvailableToSpend = profile.today_income - dailySavingTarget;

    // Method 2: Based on Total Balance (Long-term)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let totalSavingRequired = 0;
    let longestMissionDuration = 0;

    goals.forEach(goal => {
        const remainingAmount = goal.target_amount - goal.saved_amount;
        if (remainingAmount > 0) {
            totalSavingRequired += remainingAmount;
        }
        const targetDate = new Date(goal.target_date);
        const daysRemaining = Math.max(1, Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24)));
        if (daysRemaining > longestMissionDuration) {
            longestMissionDuration = daysRemaining;
        }
    });
    
    const balanceAfterMissions = profile.total_balance - totalSavingRequired;
    const longTermDailyBudget = (longestMissionDuration > 0) ? (balanceAfterMissions / longestMissionDuration) : 0;

    // Use the LOWER of the two (more conservative)
    const safeBudget = Math.min(todayAvailableToSpend, longTermDailyBudget);
    
    return Math.floor(Math.max(0, safeBudget)); // Never negative
}


/**
 * Calculates the daily savings target based on all active goals.
 * @param {object} supabase - The user-scoped Supabase client.
 * @param {string} userId - The ID of the user.
 * @param {Array} goals - The user's active goals.
 */
function calculateDailySavingTarget(goals) {
  if (!goals || goals.length === 0) {
    return 0;
  }

  let totalDailyTarget = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  goals.forEach(goal => {
    const targetDate = new Date(goal.target_date);
    const remainingAmount = goal.target_amount - goal.saved_amount;

    if (remainingAmount > 0) {
        const daysRemaining = Math.max(1, Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24)));
        const dailyTargetForGoal = remainingAmount / daysRemaining;
        const weight = goal.category ? goal.category.weight : 0;
        totalDailyTarget += dailyTargetForGoal * weight;
    }
  });

  return Math.ceil(totalDailyTarget);
}


/**
 * Allocates income to user's goals based on category weights and updates profile.
 * @param {object} supabase - The user-scoped Supabase client.
 * @param {string} userId - The ID of the user.
 * @param {number} incomeAmount - The positive income amount to allocate.
 */
const allocateIncomeAndRecalculate = async (supabase, userId, incomeAmount) => {
  console.log(`Starting allocation for user ${userId} with amount ${incomeAmount}`);

  const { data: goals, error: goalsError } = await supabase
    .from('goals')
    .select('id, target_amount, saved_amount, target_date, category:categories(id, name, weight)')
    .eq('user_id', userId);

  if (goalsError) {
    console.error('Error fetching goals for allocation:', goalsError);
    throw new Error('Could not fetch goals for allocation.');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profileError) {
      console.error('Error fetching profile for balance update:', profileError);
      throw new Error('Failed to fetch profile for balance update.');
  }
  
  const newTotalBalance = (profile.total_balance || 0) + incomeAmount;
  const newTodayIncome = (profile.today_income || 0) + incomeAmount;

  if (goals && goals.length > 0) {
    const goalUpdates = goals.map(goal => {
      const weight = goal.category ? goal.category.weight : 0;
      const allocation = incomeAmount * weight;
      return {
        id: goal.id,
        saved_amount: goal.saved_amount + allocation,
      };
    });

    for (const goalUpdate of goalUpdates) {
      const { error: updateError } = await supabase
        .from('goals')
        .update({ saved_amount: goalUpdate.saved_amount })
        .eq('id', goalUpdate.id);

      if (updateError) {
        console.error(`Error updating goal ${goalUpdate.id}:`, updateError);
        throw new Error(`Failed to update goal ${goalUpdate.id}.`);
      }
    }
  }

  const updatedProfileData = { ...profile, total_balance: newTotalBalance, today_income: newTodayIncome };

  const newDailySavingsTarget = calculateDailySavingTarget(goals);
  const newDailySpendingBuffer = calculateDailySpendingBuffer(updatedProfileData, newDailySavingsTarget, goals);

  const { error: updateProfileError } = await supabase
    .from('profiles')
    .update({
      total_balance: newTotalBalance,
      today_income: newTodayIncome,
      daily_savings_target: newDailySavingsTarget,
      daily_spending_buffer: newDailySpendingBuffer,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (updateProfileError) {
    console.error('Error updating profile after allocation:', updateProfileError);
    throw new Error('Failed to update profile after allocation.');
  }
  console.log(`Profile updated for user ${userId}. New balance: ${newTotalBalance}`);
};


/**
 * Handles an expense transaction, deducting from the user's total balance and recalculating metrics.
 * @param {object} supabase - The user-scoped Supabase client.
 * @param {string} userId - The ID of the user.
 * @param {number} expenseAmount - The absolute value of the expense.
 */
const handleExpense = async (supabase, userId, expenseAmount) => {
    console.log(`Handling expense for user ${userId} with amount ${expenseAmount}`);

    const { data: goals, error: goalsError } = await supabase
        .from('goals')
        .select('id, target_amount, saved_amount, target_date, category:categories(id, name, weight)')
        .eq('user_id', userId);

    if (goalsError) throw new Error('Could not fetch goals for expense handling.');

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (profileError) throw new Error('Could not fetch profile for expense.');

    const newTotalBalance = (profile.total_balance || 0) - expenseAmount;
    const newTodayExpenses = (profile.today_expenses || 0) + expenseAmount;
    
    const updatedProfileData = { ...profile, total_balance: newTotalBalance, today_expenses: newTodayExpenses };

    const newDailySavingsTarget = calculateDailySavingTarget(goals);
    const newDailySpendingBuffer = calculateDailySpendingBuffer(updatedProfileData, newDailySavingsTarget, goals);

    const { error: updateError } = await supabase
        .from('profiles')
        .update({
            total_balance: newTotalBalance,
            today_expenses: newTodayExpenses,
            daily_savings_target: newDailySavingsTarget,
            daily_spending_buffer: newDailySpendingBuffer,
            updated_at: new Date().toISOString()
        })
        .eq('id', userId);

    if (updateError) {
        console.error('Error updating profile after expense:', updateError);
        throw new Error('Failed to update profile after expense.');
    }
    console.log(`Profile updated for user ${userId}. New balance: ${newTotalBalance}`);
};


module.exports = {
  allocateIncomeAndRecalculate,
  handleExpense,
  calculateDailySavingTarget,
  calculateDailySpendingBuffer,
};