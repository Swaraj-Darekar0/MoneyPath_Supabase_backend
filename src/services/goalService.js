// Mbackend/src/services/goalService.js

const createGoal = async (supabase, userId, goalData) => {
  const { name, description, target_amount, target_date, category } = goalData;

  // 1. Find the category ID based on the category name
  const { data: categoryData, error: categoryError } = await supabase
    .from('categories')
    .select('id')
    .eq('name', category)
    .single();

  if (categoryError || !categoryData) {
    throw new Error(`Invalid category: ${category}`);
  }
  const category_id = categoryData.id;

  // 2. Insert the new goal
  const { data: newGoal, error: insertError } = await supabase
    .from('goals')
    .insert({
      user_id: userId,
      name,
      description,
      target_amount,
      category_id,
      target_date: new Date(target_date).toISOString().split('T')[0],
        saved_amount: 0,
        status: 'ON_TRACK',
        days_offset: 0,
        status_message: 'Goal created. Start saving!'
    })
    .select()
    .single();

  if (insertError) {
    console.error('Error in goalService.createGoal:', insertError);
    throw new Error('Failed to create goal in service.');
  }

  return newGoal;
};

const getCategories = async (supabase) => {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, weight');

  if (error) {
    console.error('Error in goalService.getCategories:', error);
    throw new Error('Failed to fetch categories in service.');
  }

  return data;
};

const getGoals = async (supabase, userId) => {
  const { data: goals, error } = await supabase
    .from('goals')
    .select(`
      id,
      name,
      description,
      target_amount,
      saved_amount,
      target_date,
      status,
      days_offset,
      status_message,
      category:categories(name, weight)
    `)
    .eq('user_id', userId);

  if (error) {
    console.error('Error in goalService.getGoals:', error);
    throw error;
  }

  const formattedGoals = goals.map(goal => ({
    ...goal,
    category: goal.category ? goal.category.name : null,
    categoryWeight: goal.category ? goal.category.weight : 0
  }));

  return formattedGoals;
};

module.exports = {
  createGoal,
  getCategories,
  getGoals,
};