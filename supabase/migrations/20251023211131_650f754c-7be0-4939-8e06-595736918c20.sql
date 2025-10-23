-- Create enum for role types matching TypeScript definitions
CREATE TYPE public.app_role AS ENUM ('user', 'admin', 'super_admin', 'uber_admin');

-- Migrate existing roles to use the enum
-- First, update any non-standard role names to 'user' as default
UPDATE public.roles SET name = 'user' WHERE name NOT IN ('admin', 'user', 'super_admin', 'uber_admin');

-- Now alter the column to use the enum type
ALTER TABLE public.roles ALTER COLUMN name TYPE app_role USING name::app_role;

-- Add comment documenting role hierarchy
COMMENT ON TYPE public.app_role IS 'Application role hierarchy: user (basic access), admin (tenant admin), super_admin (multi-tenant admin), uber_admin (platform admin)';
