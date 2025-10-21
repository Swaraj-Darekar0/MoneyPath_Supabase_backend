const supabase = require('../config/supabaseClient');
const { allocateIncomeAndRecalculate, handleExpense } = require('../services/financialEngine');

const createTransaction = async (req, res) => {
  const userId = req.user.id;
  const { amount, note } = req.body;

  if (amount == null) {
    return res.status(400).json({ error: 'Amount is a required field.' });
  }

  try {
    // 1. Record the transaction
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert({ user_id: userId, amount, note })
      .select()
      .single();

    if (transactionError) {
      throw new Error('Failed to record transaction.');
    }

    // 2. Process the transaction using the financial engine
    if (amount > 0) {
      // Handle income and auto-allocation
      await allocateIncomeAndRecalculate(supabase, userId, amount);
    } else {
      // Handle expense
      await handleExpense(supabase, userId, Math.abs(amount));
    }

    res.status(201).json({ message: 'Transaction processed successfully', transaction });

  } catch (error) {
    console.error('Error processing transaction:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = { createTransaction };