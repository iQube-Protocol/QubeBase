-- Rename black schema to blak (Binary Logic Avoiding Knowledge)

-- Step 1: Rename the schema
ALTER SCHEMA black RENAME TO blak;

-- Step 2: Rename the black_pointer column to blak_pointer
ALTER TABLE registry_mirror.instances RENAME COLUMN black_pointer TO blak_pointer;

-- Step 3: Update schema comment
COMMENT ON SCHEMA blak IS 'Binary Logic Avoiding Knowledge - secure payload storage with privacy-preserving encryption';