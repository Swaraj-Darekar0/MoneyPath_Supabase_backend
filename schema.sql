-- 1. PROFILES TABLE
-- Stores public user information and their financial summary.
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  total_balance NUMERIC NOT NULL DEFAULT 0,
  daily_spending_buffer NUMERIC NOT NULL DEFAULT 0,
  daily_savings_target NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS) for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own profile.
CREATE POLICY "Users can see their own profile."
ON public.profiles FOR SELECT
USING (auth.uid() = id);

-- Policy: Users can update their own profile.
CREATE POLICY "Users can update their own profile."
ON public.profiles FOR UPDATE
USING (auth.uid() = id);


-- 2. CATEGORIES TABLE
-- Stores the different goal categories and their allocation weights.
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  weight NUMERIC NOT NULL CHECK (weight >= 0 AND weight <= 1)
);

-- Enable RLS for categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read all categories.
CREATE POLICY "Authenticated users can read categories."
ON public.categories FOR SELECT
USING (auth.role() = 'authenticated');

-- Pre-populate categories (optional, but recommended)
INSERT INTO public.categories (name, weight) VALUES
('Non-Negotiables', 0.60),
('Big Moves', 0.30),
('Flex Goals', 0.10);


-- 3. GOALS TABLE
-- Stores user-created financial goals.
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id),
  name TEXT NOT NULL,
  description TEXT,
  target_amount NUMERIC NOT NULL,
  saved_amount NUMERIC NOT NULL DEFAULT 0,
  target_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for goals
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own goals.
CREATE POLICY "Users can manage their own goals."
ON public.goals FOR ALL
USING (auth.uid() = user_id);


-- 4. TRANSACTIONS TABLE
-- Stores all income and expense transactions for a user.
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL, -- Positive for income, negative for expense
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own transactions.
CREATE POLICY "Users can manage their own transactions."
ON public.transactions FOR ALL
USING (auth.uid() = user_id);

-- 5. NEW USER TRIGGER
-- Function to create a profile for a new user.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

 
-- Trigger to run the function when a new user is created.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();