-- Add new columns to profiles table for advanced financial tracking
ALTER TABLE public.profiles
ADD COLUMN opening_balance NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN today_income NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN today_expenses NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN average_daily_income NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN average_daily_expenses NUMERIC NOT NULL DEFAULT 0;
