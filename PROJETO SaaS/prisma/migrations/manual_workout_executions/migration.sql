DO $$
BEGIN
  IF to_regtype('"WorkoutExecutionStatus"') IS NULL THEN
    CREATE TYPE "WorkoutExecutionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS "workout_executions" (
  "id" TEXT NOT NULL,
  "personalId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "workoutId" TEXT NOT NULL,
  "status" "WorkoutExecutionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workout_executions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "workout_set_logs" (
  "id" TEXT NOT NULL,
  "personalId" TEXT NOT NULL,
  "workoutId" TEXT NOT NULL,
  "executionId" TEXT NOT NULL,
  "workoutExerciseId" TEXT NOT NULL,
  "setNumber" INTEGER NOT NULL,
  "repsCompleted" INTEGER NOT NULL,
  "loadKg" DECIMAL(8,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workout_set_logs_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"workout_executions"'::regclass
      AND conname = 'workout_executions_personal_fk'
  ) THEN
    ALTER TABLE "workout_executions"
      ADD CONSTRAINT "workout_executions_personal_fk"
      FOREIGN KEY ("personalId") REFERENCES "personals" ("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"workout_executions"'::regclass
      AND conname = 'workout_executions_student_tenant_fk'
  ) THEN
    ALTER TABLE "workout_executions"
      ADD CONSTRAINT "workout_executions_student_tenant_fk"
      FOREIGN KEY ("studentId", "personalId") REFERENCES "students" ("id", "personalId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"workout_executions"'::regclass
      AND conname = 'workout_executions_workout_tenant_fk'
  ) THEN
    ALTER TABLE "workout_executions"
      ADD CONSTRAINT "workout_executions_workout_tenant_fk"
      FOREIGN KEY ("workoutId", "personalId") REFERENCES "workouts" ("id", "personalId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"workout_set_logs"'::regclass
      AND conname = 'workout_set_logs_personal_fk'
  ) THEN
    ALTER TABLE "workout_set_logs"
      ADD CONSTRAINT "workout_set_logs_personal_fk"
      FOREIGN KEY ("personalId") REFERENCES "personals" ("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"workout_set_logs"'::regclass
      AND conname = 'workout_set_logs_execution_fk'
  ) THEN
    ALTER TABLE "workout_set_logs"
      ADD CONSTRAINT "workout_set_logs_execution_fk"
      FOREIGN KEY ("executionId") REFERENCES "workout_executions" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"workout_set_logs"'::regclass
      AND conname = 'workout_set_logs_workout_tenant_fk'
  ) THEN
    ALTER TABLE "workout_set_logs"
      ADD CONSTRAINT "workout_set_logs_workout_tenant_fk"
      FOREIGN KEY ("workoutId", "personalId") REFERENCES "workouts" ("id", "personalId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"workout_set_logs"'::regclass
      AND conname = 'workout_set_logs_exercise_fk'
  ) THEN
    ALTER TABLE "workout_set_logs"
      ADD CONSTRAINT "workout_set_logs_exercise_fk"
      FOREIGN KEY ("workoutExerciseId") REFERENCES "workout_exercises" ("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"workout_set_logs"'::regclass
      AND conname = 'workout_set_logs_set_number_check'
  ) THEN
    ALTER TABLE "workout_set_logs"
      ADD CONSTRAINT "workout_set_logs_set_number_check" CHECK ("setNumber" BETWEEN 1 AND 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"workout_set_logs"'::regclass
      AND conname = 'workout_set_logs_reps_completed_check'
  ) THEN
    ALTER TABLE "workout_set_logs"
      ADD CONSTRAINT "workout_set_logs_reps_completed_check" CHECK ("repsCompleted" BETWEEN 0 AND 1000);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"workout_set_logs"'::regclass
      AND conname = 'workout_set_logs_load_kg_check'
  ) THEN
    ALTER TABLE "workout_set_logs"
      ADD CONSTRAINT "workout_set_logs_load_kg_check"
      CHECK ("loadKg" IS NULL OR "loadKg" BETWEEN 0 AND 1000);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"workout_executions"'::regclass
      AND conname = 'workout_executions_completion_check'
  ) THEN
    ALTER TABLE "workout_executions"
      ADD CONSTRAINT "workout_executions_completion_check"
      CHECK (("status" = 'COMPLETED') = ("completedAt" IS NOT NULL));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS "workout_executions_personalId_studentId_startedAt_idx"
  ON "workout_executions" ("personalId", "studentId", "startedAt");
CREATE INDEX IF NOT EXISTS "workout_executions_personalId_workoutId_startedAt_idx"
  ON "workout_executions" ("personalId", "workoutId", "startedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "workout_set_logs_executionId_workoutExerciseId_setNumber_key"
  ON "workout_set_logs" ("executionId", "workoutExerciseId", "setNumber");
CREATE INDEX IF NOT EXISTS "workout_set_logs_personalId_executionId_idx"
  ON "workout_set_logs" ("personalId", "executionId");

CREATE OR REPLACE FUNCTION workout_executions_validate_tenant()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM "workouts" w
      JOIN "students" s
        ON s."id" = w."studentId"
       AND s."personalId" = w."personalId"
     WHERE w."id" = NEW."workoutId"
       AND w."studentId" = NEW."studentId"
       AND w."personalId" = NEW."personalId"
  ) THEN
    RAISE EXCEPTION 'workout execution must match the workout student and tenant';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION workout_set_logs_validate_tenant()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM "workout_exercises" e
      JOIN "workout_executions" x
        ON x."id" = NEW."executionId"
      JOIN "workouts" w
        ON w."id" = NEW."workoutId"
     WHERE e."id" = NEW."workoutExerciseId"
       AND e."workoutId" = NEW."workoutId"
       AND e."personalId" = NEW."personalId"
       AND x."workoutId" = NEW."workoutId"
       AND x."personalId" = NEW."personalId"
       AND w."personalId" = NEW."personalId"
  ) THEN
    RAISE EXCEPTION 'workout set log must match its exercise, execution, workout, and tenant';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = '"workout_executions"'::regclass
      AND tgname = 'workout_executions_tenant_guard'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER workout_executions_tenant_guard
      BEFORE INSERT OR UPDATE ON "workout_executions"
      FOR EACH ROW EXECUTE FUNCTION workout_executions_validate_tenant();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = '"workout_set_logs"'::regclass
      AND tgname = 'workout_set_logs_tenant_guard'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER workout_set_logs_tenant_guard
      BEFORE INSERT OR UPDATE ON "workout_set_logs"
      FOR EACH ROW EXECUTE FUNCTION workout_set_logs_validate_tenant();
  END IF;
END;
$$;
