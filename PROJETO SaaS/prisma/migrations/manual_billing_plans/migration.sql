CREATE TABLE IF NOT EXISTS "plans" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "stripePriceId" TEXT NOT NULL,
  "maxStudents" INTEGER,
  "maxWorkouts" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "plans_name_key" ON "plans"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "plans_stripePriceId_key" ON "plans"("stripePriceId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'plans_maxStudents_check'
  ) THEN
    ALTER TABLE "plans"
      ADD CONSTRAINT "plans_maxStudents_check"
      CHECK ("maxStudents" IS NULL OR "maxStudents" >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'plans_maxWorkouts_check'
  ) THEN
    ALTER TABLE "plans"
      ADD CONSTRAINT "plans_maxWorkouts_check"
      CHECK ("maxWorkouts" IS NULL OR "maxWorkouts" >= 0);
  END IF;
END;
$$;

ALTER TABLE "billing_subscriptions"
  ADD COLUMN IF NOT EXISTS "planId" TEXT;

CREATE INDEX IF NOT EXISTS "billing_subscriptions_planId_idx"
  ON "billing_subscriptions"("planId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'billing_subscriptions_planId_fkey'
  ) THEN
    ALTER TABLE "billing_subscriptions"
      ADD CONSTRAINT "billing_subscriptions_planId_fkey"
      FOREIGN KEY ("planId") REFERENCES "plans"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END;
$$;
