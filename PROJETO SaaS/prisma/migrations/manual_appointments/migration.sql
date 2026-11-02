DO $$
BEGIN
  IF to_regtype('"AppointmentStatus"') IS NULL THEN
    CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS "appointments" (
  "id" TEXT NOT NULL,
  "personalId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "workoutId" TEXT,
  "title" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "appointments"
  ADD COLUMN IF NOT EXISTS "workoutId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"appointments"'::regclass
      AND confrelid = '"personals"'::regclass
      AND contype = 'f'
      AND EXISTS (
        SELECT 1 FROM pg_attribute
        WHERE attrelid = '"appointments"'::regclass
          AND attname = 'personalId'
          AND attnum = ANY(pg_constraint.conkey)
      )
  ) THEN
    ALTER TABLE "appointments"
      ADD CONSTRAINT "appointments_personal_fk"
      FOREIGN KEY ("personalId") REFERENCES "personals" ("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"appointments"'::regclass
      AND conname = 'appointments_student_tenant_fk'
  ) THEN
    ALTER TABLE "appointments"
      ADD CONSTRAINT "appointments_student_tenant_fk"
      FOREIGN KEY ("studentId", "personalId") REFERENCES "students" ("id", "personalId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"appointments"'::regclass
      AND conname = 'appointments_workoutId_fkey'
  ) THEN
    ALTER TABLE "appointments"
      ADD CONSTRAINT "appointments_workoutId_fkey"
      FOREIGN KEY ("workoutId") REFERENCES "workouts" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"appointments"'::regclass
      AND conname = 'appointments_time_order_check'
  ) THEN
    ALTER TABLE "appointments"
      ADD CONSTRAINT "appointments_time_order_check"
      CHECK ("startsAt" < "endsAt");
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS "appointments_personalId_startsAt_endsAt_status_idx"
  ON "appointments" ("personalId", "startsAt", "endsAt", "status");
CREATE INDEX IF NOT EXISTS "appointments_studentId_startsAt_idx"
  ON "appointments" ("studentId", "startsAt");
CREATE INDEX IF NOT EXISTS "appointments_workoutId_idx"
  ON "appointments" ("workoutId");

CREATE OR REPLACE FUNCTION appointments_prevent_overlap()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW."personalId"));

  IF NEW."status" = 'SCHEDULED' AND EXISTS (
    SELECT 1
      FROM "appointments" existing
     WHERE existing."personalId" = NEW."personalId"
       AND existing."status" = 'SCHEDULED'
       AND existing."id" <> NEW."id"
       AND existing."startsAt" < NEW."endsAt"
       AND existing."endsAt" > NEW."startsAt"
  ) THEN
    RAISE EXCEPTION 'appointment time conflict'
      USING ERRCODE = '23P01', CONSTRAINT = 'appointments_no_overlap';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = '"appointments"'::regclass
      AND tgname = 'appointments_no_overlap'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER appointments_no_overlap
      BEFORE INSERT OR UPDATE OF "personalId", "startsAt", "endsAt", "status"
      ON "appointments"
      FOR EACH ROW EXECUTE FUNCTION appointments_prevent_overlap();
  END IF;
END;
$$;
