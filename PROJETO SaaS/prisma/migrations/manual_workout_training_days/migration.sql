DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorkoutDay') THEN
    CREATE TYPE "WorkoutDay" AS ENUM (
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
      'SUNDAY'
    );
  END IF;
END;
$$;

ALTER TABLE "workouts"
  ADD COLUMN IF NOT EXISTS "trainingDays" "WorkoutDay"[] NOT NULL DEFAULT ARRAY[]::"WorkoutDay"[];
