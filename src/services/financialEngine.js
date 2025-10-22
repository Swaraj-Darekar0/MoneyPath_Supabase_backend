// Mbackend/src/services/financialEngine.js

/**
 * Calculates the buffer status based on total balance and savings required
 * @param {object} profile - User profile with balance and expenses
 * @param {number} totalSavingRequired - Total amount needed for all goals
 * @returns {object} Buffer status details
 */
function calculateBufferStatus(profile, totalSavingRequired) {
    const buffer = profile.total_balance - totalSavingRequired;
    const bufferDays = Math.floor(buffer / (profile.average_daily_expenses || 1000));
    
    return {
        buffer,
        bufferDays,
        status: bufferDays < 0 ? 'CRITICAL' :
                bufferDays < 7 ? 'LOW' :
                bufferDays < 30 ? 'MODERATE' : 'HEALTHY',
        message: bufferDays < 0 ? `Deficit: $${Math.abs(buffer)}. Increase income or extend deadlines.` :
                 bufferDays < 7 ? `${bufferDays} days of safety. Execute with caution.` :
                 bufferDays < 30 ? `${bufferDays} days of safety. Maintain discipline.` :
                 `${bufferDays} days of safety. Surplus detected.`
    };
}

/**
 * Detects and handles overspending situations
 * @param {object} profile - User profile with expenses
 * @param {number} expenseAmount - New expense amount
 * @param {number} dailySpendingBuffer - Current daily spending allowance
 * @returns {object|null} Overspending details if detected
 */
function detectOverspending(profile, expenseAmount, dailySpendingBuffer) {
    const todayTotal = (profile.today_expenses || 0) + expenseAmount;
    if (todayTotal > dailySpendingBuffer) {
        const overspent = todayTotal - dailySpendingBuffer;
        const daysAdded = Math.ceil(overspent / profile.daily_savings_target);
        return {
            overspent,
            recoveryRequired: true,
            tomorrowTarget: profile.daily_savings_target + overspent,
            daysAdded,
            message: `Overspent by $${overspent}. Tomorrow's target: $${profile.daily_savings_target + overspent}. All missions delayed by ${daysAdded} days.`
        };
    }
    return null;
}

/**
 * Handles surplus allocation to goals
 * @param {number} income - Today's income
 * @param {number} savingsTarget - Daily savings target
 * @param {number} expenses - Today's expenses
 * @param {Array} goals - Active goals
 * @returns {object|null} Surplus allocation details if surplus exists
 */
function handleSurplus(income, savingsTarget, expenses, goals) {
    const surplus = income - (savingsTarget + expenses);
    if (surplus > 0) {
        // Find highest priority goal
        const priorityGoal = goals.reduce((highest, current) => {
            if (!highest || (current.category?.weight > highest.category?.weight)) {
                return current;
            }
            return highest;
        }, null);

        if (priorityGoal) {
            const daysAccelerated = Math.floor(surplus / (priorityGoal.target_amount / priorityGoal.daysRemaining));
            return {
                amount: surplus,
                allocatedTo: priorityGoal.name,
                daysAccelerated,
                message: `Surplus: $${surplus}. ${priorityGoal.name} accelerated by ${daysAccelerated} days.`
            };
        }
    }
    return null;
}

/**
 * Updates goal progress status
 * @param {object} goal - Goal object with progress details
 * @returns {object} Updated status information
 */
function updateGoalStatus(goal) {
    const today = new Date();
    const startDate = new Date(goal.created_at);
    const targetDate = new Date(goal.target_date);
    
    const totalDuration = targetDate - startDate;
    const elapsed = today - startDate;
    
    const expectedProgress = elapsed / totalDuration;
    const actualProgress = goal.saved_amount / goal.target_amount;
    
    const progressDiff = actualProgress - expectedProgress;
    const daysOffset = Math.floor(progressDiff * (targetDate - startDate) / (1000 * 60 * 60 * 24));
    
    return {
        status: progressDiff >= 0.1 ? 'AHEAD' :
                progressDiff <= -0.1 ? 'BEHIND' : 'ON_TRACK',
        daysOffset,
        message: daysOffset > 0 ? `${Math.abs(daysOffset)} days ahead of schedule` :
                daysOffset < 0 ? `${Math.abs(daysOffset)} days behind schedule` :
                'On track with schedule'
    };
}

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
    .select('id, target_amount, saved_amount, target_date, created_at, category:categories(id, name, weight)')
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

  // Calculate new daily savings target before allocation
  const newDailySavingsTarget = calculateDailySavingTarget(goals);

  // Check for surplus
  const surplusStatus = handleSurplus(
    incomeAmount,
    newDailySavingsTarget,
    profile.today_expenses || 0,
    goals
  );

  if (goals && goals.length > 0) {
    const goalUpdates = goals.map(goal => {
      const weight = goal.category ? goal.category.weight : 0;
      let allocation = incomeAmount * weight;
      
      // Add surplus allocation if this is the priority goal
      if (surplusStatus && surplusStatus.allocatedTo === goal.name) {
        allocation += surplusStatus.amount;
      }

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

  // Calculate buffer status
  let totalSavingRequired = 0;
  goals.forEach(goal => {
      const remainingAmount = goal.target_amount - goal.saved_amount;
      if (remainingAmount > 0) totalSavingRequired += remainingAmount;
  });
  const bufferStatus = calculateBufferStatus(updatedProfileData, totalSavingRequired);

  // Update goal statuses
  const goalStatuses = goals.map(goal => {
      const status = updateGoalStatus(goal);
      return {
          goalId: goal.id,
          ...status
      };
  });

  const newDailySpendingBuffer = calculateDailySpendingBuffer(updatedProfileData, newDailySavingsTarget, goals);

  // Update profile with new status and surplus information
  const { error: updateProfileError } = await supabase
    .from('profiles')
    .update({
      total_balance: newTotalBalance,
      today_income: newTodayIncome,
      daily_savings_target: newDailySavingsTarget,
      daily_spending_buffer: newDailySpendingBuffer,
      buffer_status: bufferStatus.status,
      buffer_days: bufferStatus.bufferDays,
      surplus_allocation: surplusStatus ? JSON.stringify(surplusStatus) : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (updateProfileError) {
    console.error('Error updating profile after allocation:', updateProfileError);
    throw new Error('Failed to update profile after allocation.');
  }

  // Update goal statuses in database
  for (const status of goalStatuses) {
      await supabase
          .from('goals')
          .update({
              status: status.status,
              days_offset: status.daysOffset,
              status_message: status.message
          })
          .eq('id', status.goalId);
  }

  console.log(`Profile updated for user ${userId}. New balance: ${newTotalBalance}`);
  if (surplusStatus) {
      console.log('Surplus detected:', surplusStatus.message);
  }
  console.log('Buffer status:', bufferStatus.message);
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
        .select('id, target_amount, saved_amount, target_date, created_at, category:categories(id, name, weight)')
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

    // Check for overspending
    const overspendingStatus = detectOverspending(profile, expenseAmount, profile.daily_spending_buffer);
    
    // Calculate buffer status
    let totalSavingRequired = 0;
    goals.forEach(goal => {
        const remainingAmount = goal.target_amount - goal.saved_amount;
        if (remainingAmount > 0) totalSavingRequired += remainingAmount;
    });
    const bufferStatus = calculateBufferStatus(updatedProfileData, totalSavingRequired);

    // Update goal statuses
    const goalStatuses = goals.map(goal => {
        const status = updateGoalStatus(goal);
        return {
            goalId: goal.id,
            ...status
        };
    });

    // Update profile with new status
    const { error: updateError } = await supabase
        .from('profiles')
        .update({
            total_balance: newTotalBalance,
            today_expenses: newTodayExpenses,
            daily_savings_target: newDailySavingsTarget,
            daily_spending_buffer: newDailySpendingBuffer,
            buffer_status: bufferStatus.status,
            buffer_days: bufferStatus.bufferDays,
            overspending_recovery: overspendingStatus ? JSON.stringify(overspendingStatus) : null,
            updated_at: new Date().toISOString()
        })
        .eq('id', userId);

    if (updateError) {
        console.error('Error updating profile after expense:', updateError);
        throw new Error('Failed to update profile after expense.');
    }

    // Update goal statuses in database
    for (const status of goalStatuses) {
        await supabase
            .from('goals')
            .update({
                status: status.status,
                days_offset: status.daysOffset,
                status_message: status.message
            })
            .eq('id', status.goalId);
    }

    console.log(`Profile updated for user ${userId}. New balance: ${newTotalBalance}`);
    
    if (overspendingStatus) {
        console.log('Overspending detected:', overspendingStatus.message);
    }
    console.log('Buffer status:', bufferStatus.message);
};


module.exports = {
  allocateIncomeAndRecalculate,
  handleExpense,
  calculateDailySavingTarget,
  calculateDailySpendingBuffer,
  calculateBufferStatus,
  detectOverspending,
  handleSurplus,
  updateGoalStatus
};