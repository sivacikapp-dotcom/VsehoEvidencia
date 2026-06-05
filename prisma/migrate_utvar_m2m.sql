-- Re-create UserUtvar junction table for many-to-many membership
CREATE TABLE IF NOT EXISTS "UserUtvar" (
  "userId"  INTEGER NOT NULL,
  "utvarId" INTEGER NOT NULL,
  CONSTRAINT "UserUtvar_pkey"      PRIMARY KEY ("userId", "utvarId"),
  CONSTRAINT "UserUtvar_userId_fkey"  FOREIGN KEY ("userId")  REFERENCES "User"("id")  ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserUtvar_utvarId_fkey" FOREIGN KEY ("utvarId") REFERENCES "Utvar"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Backfill from the direct utvarId column
INSERT INTO "UserUtvar" ("userId", "utvarId")
SELECT "id", "utvarId"
FROM "User"
WHERE "utvarId" IS NOT NULL
ON CONFLICT ("userId", "utvarId") DO NOTHING;
