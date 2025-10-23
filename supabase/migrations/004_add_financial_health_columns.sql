ALTER TABLE public.profiles
ADD COLUMN today_income NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN today_expenses NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN buffer_status TEXT,
ADD COLUMN buffer_days INTEGER,
ADD COLUMN surplus_allocation JSONB,
ADD COLUMN overspending_recovery JSONB,
ADD COLUMN last_daily_reset_date DATE;