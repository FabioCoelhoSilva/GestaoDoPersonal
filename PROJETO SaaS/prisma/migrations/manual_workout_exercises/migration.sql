CREATE TABLE IF NOT EXISTS "workout_exercises" (
  "id" TEXT NOT NULL,
  "personalId" TEXT NOT NULL,
  "workoutId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "gifUrl" VARCHAR(2048),
  "sets" INTEGER NOT NULL,
  "reps" TEXT NOT NULL,
  "restSeconds" INTEGER,
  "order" INTEGER NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workout_exercises_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "workout_exercises"
  ADD COLUMN IF NOT EXISTS "gifUrl" VARCHAR(2048);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = '"workout_exercises"'::regclass
      AND contype = 'f'
  ) THEN
    ALTER TABLE "workout_exercises"
      ADD CONSTRAINT "workout_exercises_workout_tenant_fk"
      FOREIGN KEY ("workoutId", "personalId")
      REFERENCES "workouts" ("id", "personalId")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"workout_exercises"'::regclass
      AND conname = 'workout_exercises_sets_check'
  ) THEN
    ALTER TABLE "workout_exercises"
      ADD CONSTRAINT "workout_exercises_sets_check" CHECK ("sets" BETWEEN 1 AND 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"workout_exercises"'::regclass
      AND conname = 'workout_exercises_rest_seconds_check'
  ) THEN
    ALTER TABLE "workout_exercises"
      ADD CONSTRAINT "workout_exercises_rest_seconds_check"
      CHECK ("restSeconds" IS NULL OR "restSeconds" BETWEEN 0 AND 7200);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"workout_exercises"'::regclass
      AND conname = 'workout_exercises_order_check'
  ) THEN
    ALTER TABLE "workout_exercises"
      ADD CONSTRAINT "workout_exercises_order_check" CHECK ("order" >= 0);
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "workout_exercises_workoutId_personalId_order_key"
  ON "workout_exercises" ("workoutId", "personalId", "order");

CREATE INDEX IF NOT EXISTS "workout_exercises_personalId_workoutId_idx"
  ON "workout_exercises" ("personalId", "workoutId");
