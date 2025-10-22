-- Add new columns to profiles table for enhanced financial tracking
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS buffer_status TEXT,
ADD COLUMN IF NOT EXISTS buffer_days INTEGER,
ADD COLUMN IF NOT EXISTS average_daily_expenses NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS average_daily_income NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS today_income NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS today_expenses NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS overspending_recovery JSONB,
ADD COLUMN IF NOT EXISTS surplus_allocation JSONB;

-- Add new columns to goals table for status tracking
ALTER TABLE public.goals
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ON_TRACK',
ADD COLUMN IF NOT EXISTS days_offset INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS status_message TEXT;


-- Add a trigger to reset daily counters at midnight
CREATE OR REPLACE FUNCTION reset_daily_counters()
RETURNS TRIGGER AS $$
BEGIN
  NEW.today_income := 0;
  NEW.today_expenses := 0;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER midnight_reset
  BEFORE UPDATE OF updated_at ON public.profiles
  FOR EACH ROW
  WHEN (OLD.updated_at::date < NEW.updated_at::date)
  EXECUTE FUNCTION reset_daily_counters();

  -- Function to update averages based on last 30 days
CREATE OR REPLACE FUNCTION update_daily_averages(user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET 
    average_daily_income = (
      SELECT COALESCE(AVG(amount), 0)
      FROM public.transactions
      WHERE user_id = $1 
      AND amount > 0
      AND created_at >= NOW() - INTERVAL '30 days'
    ),
    average_daily_expenses = (
      SELECT COALESCE(ABS(AVG(amount)), 0)
      FROM public.transactions
      WHERE user_id = $1 
      AND amount < 0
      AND created_at >= NOW() - INTERVAL '30 days'
    )
  WHERE id = $1;
END;
$$ LANGUAGE plpgsql;