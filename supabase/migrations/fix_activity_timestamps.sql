-- Fix Activity table to use server-side timestamps instead of client-side
-- This prevents issues when the user's browser clock is wrong

-- Add DB-level default for createdAt (uses the DB server's clock, always accurate)
ALTER TABLE "Activity" ALTER COLUMN "createdAt" SET DEFAULT now();

-- Also ensure id gets a default UUID if not provided
-- (Supabase/Postgres requires uuid-ossp or gen_random_uuid)
ALTER TABLE "Activity" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
