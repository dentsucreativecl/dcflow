-- Migration: Convert Space.area (single TEXT) to Space.areas (TEXT array)
-- Run this in Supabase SQL Editor

-- Step 1: Add new areas array column
ALTER TABLE "Space" ADD COLUMN IF NOT EXISTS "areas" TEXT[] DEFAULT '{}';

-- Step 2: Migrate existing area values into the array
UPDATE "Space" SET "areas" = ARRAY["area"] WHERE "area" IS NOT NULL;

-- Step 3: Drop the old single-value area column
ALTER TABLE "Space" DROP COLUMN IF EXISTS "area";
