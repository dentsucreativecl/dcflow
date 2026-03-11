-- Add attachments column to Comment table
ALTER TABLE public."Comment"
ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT NULL;
