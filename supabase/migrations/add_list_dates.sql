-- Migration: Add startDate and endDate to List table
ALTER TABLE "List" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMPTZ;
ALTER TABLE "List" ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMPTZ;
