-- Add columns before schema push (avoids data loss)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "utvarId" INTEGER;
ALTER TABLE "Utvar" ADD COLUMN IF NOT EXISTS "parentId" INTEGER;
ALTER TABLE "Utvar" ADD COLUMN IF NOT EXISTS "vedouciId" INTEGER;

-- Backfill utvarId from UserUtvar (take the lowest utvarId per user)
UPDATE "User" u
SET "utvarId" = (
  SELECT uu."utvarId"
  FROM "UserUtvar" uu
  WHERE uu."userId" = u.id
  ORDER BY uu."utvarId"
  LIMIT 1
);
