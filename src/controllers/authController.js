const supabase = require('../config/supabaseClient');

const signup = async (req, res) => {
  console.log('Backend received signup request with body:', req.body);
  const { email, password, name } = req.body;

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
      },
    });

    console.log('Supabase signup response:', { data, error });

    if (error) {
      console.error('Error during signup:', error.message);
      return res.status(400).json({ error: error.message });
    }

    const responsePayload = { message: 'User created successfully', user: data.user, session: data.session };
    console.log('Sending signup success response to frontend:', responsePayload);
    res.status(200).json(responsePayload);

  } catch (error) {
    console.error('Internal server error during signup:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const login = async (req, res) => {
  console.log('Backend received login request with body:', req.body);
  const { email, password } = req.body;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    console.log('Supabase login response:', { data, error });

    if (error) {
      console.error('Error during login:', error.message);
      return res.status(400).json({ error: error.message });
    }

    const responsePayload = { message: 'Login successful', user: data.user, session: data.session };
    console.log('Sending login success response to frontend:', responsePayload);
    res.status(200).json(responsePayload);

  } catch (error) {
    console.error('Internal server error during login:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { signup, login };
