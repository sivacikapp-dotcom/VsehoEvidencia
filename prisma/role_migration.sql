-- Role migration: rename roles, remove SPRAVCA_ROLI, migrate DocRole → Role[]
-- Adds Utvar/UserUtvar tables and recreates Role enum

-- Step 1: Convert all Role[] columns to text[] to allow free manipulation
ALTER TABLE "User" ALTER COLUMN roles TYPE text[] USING roles::text[];
ALTER TABLE "AssetAttachment" ALTER COLUMN "uploaderRoles" TYPE text[] USING "uploaderRoles"::text[];

-- Step 2: Rename SPRAVCA_KARIET → SPRAVCA_MAJETKU
UPDATE "User" SET roles = array_replace(roles, 'SPRAVCA_KARIET', 'SPRAVCA_MAJETKU');

-- Step 3: Rename SPRAVCA_PC → SPRAVCA_PRACOVNYCH_CIEST
UPDATE "User" SET roles = array_replace(roles, 'SPRAVCA_PC', 'SPRAVCA_PRACOVNYCH_CIEST');

-- Step 4: Merge SPRAVCA_ROLI into SPRAVCA_APLIKACIE
-- Users with SPRAVCA_ROLI but no SPRAVCA_APLIKACIE → get SPRAVCA_APLIKACIE
UPDATE "User"
SET roles = array_append(array_remove(roles, 'SPRAVCA_ROLI'), 'SPRAVCA_APLIKACIE')
WHERE 'SPRAVCA_ROLI' = ANY(roles) AND NOT ('SPRAVCA_APLIKACIE' = ANY(roles));

-- Users with both → just remove SPRAVCA_ROLI
UPDATE "User"
SET roles = array_remove(roles, 'SPRAVCA_ROLI')
WHERE 'SPRAVCA_ROLI' = ANY(roles);

-- Step 5: Migrate docRole = SPRAVCA_DOKUMENTOV → add to roles[]
UPDATE "User"
SET roles = array_append(roles, 'SPRAVCA_DOKUMENTOV')
WHERE "docRole"::text = 'SPRAVCA_DOKUMENTOV' AND NOT ('SPRAVCA_DOKUMENTOV' = ANY(roles));

-- Step 6: Drop old Role type and recreate with new values
DROP TYPE "Role";
CREATE TYPE "Role" AS ENUM (
  'PRIJEMCA',
  'NADRIADENY',
  'BEZPECNOSTNY_PRACOVNIK',
  'SPRAVCA_MAJETKU',
  'SPRAVCA_PRACOVNYCH_CIEST',
  'SPRAVCA_APLIKACIE',
  'SPRAVCA_REGISTRATURY',
  'PRACOVNIK_PODATELNE',
  'SPRACOVATEL_REGISTRATURY',
  'SPRAVCA_DOKUMENTOV',
  'GESTOR_AGENDY',
  'GESTOR_DOKUMENTU'
);

-- Step 7: Cast back to Role[]
ALTER TABLE "User" ALTER COLUMN roles TYPE "Role"[] USING roles::"Role"[];
ALTER TABLE "AssetAttachment" ALTER COLUMN "uploaderRoles" TYPE "Role"[] USING "uploaderRoles"::"Role"[];

-- Step 8: Drop docRole column and DocRole type
ALTER TABLE "User" DROP COLUMN IF EXISTS "docRole";
DROP TYPE IF EXISTS "DocRole";
