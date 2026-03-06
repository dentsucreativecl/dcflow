-- Migration: Add area-based permissions fields
-- Run this in Supabase SQL Editor

-- Add department field to User table (internal team area)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "department" TEXT;

-- Add area field to Space table (which internal area manages this client)
ALTER TABLE "Space" ADD COLUMN IF NOT EXISTS "area" TEXT;

-- Add userAreas array field to User table (multi-area permission control)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "userAreas" TEXT[] DEFAULT '{}';
