-- Add city field to profiles table to assign BD users to their operating city
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city text;
