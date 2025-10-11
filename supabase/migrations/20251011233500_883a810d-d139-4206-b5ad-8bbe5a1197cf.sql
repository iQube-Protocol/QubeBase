-- Migration 002: Increase file size caps to 1 GiB hard cap
-- This migration documents the increase in file size limits for the platform
-- 
-- New limits:
-- - Soft cap: 500 MB (advisory warning)
-- - Hard cap: 1 GB (rejection threshold)
--
-- Note: The actual enforcement is done in the upload_intake Edge Function
-- via environment variables:
-- - APP_FILE_SOFT_CAP_BYTES=524288000 (500 MB)
-- - APP_FILE_HARD_CAP_BYTES=1073741824 (1 GB)

-- Add a comment to the payloads table documenting the size limits
COMMENT ON COLUMN black.payloads.file_size_bytes IS 'File size in bytes. Soft cap: 500 MB, Hard cap: 1 GB';

-- Add a check constraint to enforce the hard cap at the database level
-- This provides defense-in-depth alongside the Edge Function validation
ALTER TABLE black.payloads 
  DROP CONSTRAINT IF EXISTS payloads_file_size_check;

ALTER TABLE black.payloads 
  ADD CONSTRAINT payloads_file_size_check 
  CHECK (file_size_bytes > 0 AND file_size_bytes <= 1073741824);