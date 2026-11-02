-- Execute after applying the schema change that adds User.supabaseUserId.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "supabaseUserId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "users_supabaseUserId_key" ON "users" ("supabaseUserId");
