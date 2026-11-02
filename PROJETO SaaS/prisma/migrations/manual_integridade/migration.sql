-- Migration manual: integridade multi-tenant e auditoria inalterável.
-- Executar DEPOIS da migration gerada pelo Prisma (prisma migrate dev / deploy).
-- Observação: o Prisma não gera FKs compostas nem CHECK constraints; ao rodar
-- `prisma migrate diff`, esses objetos aparecem como divergência. Não remover.

-- 3) Auditoria inalterável: AccessLog é append-only
CREATE OR REPLACE FUNCTION access_logs_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'access_logs é append-only: UPDATE e DELETE são proibidos';
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"contracts"'::regclass AND conname = 'contracts_student_tenant_fk'
  ) THEN
    ALTER TABLE "contracts"
      ADD CONSTRAINT "contracts_student_tenant_fk"
      FOREIGN KEY ("studentId", "personalId") REFERENCES "students" ("id", "personalId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"payment_parcels"'::regclass AND conname = 'parcels_contract_tenant_fk'
  ) THEN
    ALTER TABLE "payment_parcels"
      ADD CONSTRAINT "parcels_contract_tenant_fk"
      FOREIGN KEY ("contractId", "personalId") REFERENCES "contracts" ("id", "personalId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"workouts"'::regclass AND conname = 'workouts_student_tenant_fk'
  ) THEN
    ALTER TABLE "workouts"
      ADD CONSTRAINT "workouts_student_tenant_fk"
      FOREIGN KEY ("studentId", "personalId") REFERENCES "students" ("id", "personalId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"exams"'::regclass AND conname = 'exams_student_tenant_fk'
  ) THEN
    ALTER TABLE "exams"
      ADD CONSTRAINT "exams_student_tenant_fk"
      FOREIGN KEY ("studentId", "personalId") REFERENCES "students" ("id", "personalId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"extra_payments"'::regclass AND conname = 'extra_payments_student_tenant_fk'
  ) THEN
    ALTER TABLE "extra_payments"
      ADD CONSTRAINT "extra_payments_student_tenant_fk"
      FOREIGN KEY ("studentId", "personalId") REFERENCES "students" ("id", "personalId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"leads"'::regclass AND conname = 'leads_converted_student_tenant_fk'
  ) THEN
    ALTER TABLE "leads"
      ADD CONSTRAINT "leads_converted_student_tenant_fk"
      FOREIGN KEY ("convertedStudentId", "personalId") REFERENCES "students" ("id", "personalId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"leads"'::regclass AND conname = 'leads_conversion_consistency'
  ) THEN
    ALTER TABLE "leads"
      ADD CONSTRAINT "leads_conversion_consistency"
      CHECK (("status" = 'CONVERTED') = ("convertedStudentId" IS NOT NULL));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = '"access_logs"'::regclass
      AND tgname = 'access_logs_no_update'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER access_logs_no_update
      BEFORE UPDATE OR DELETE ON "access_logs"
      FOR EACH ROW EXECUTE FUNCTION access_logs_block_mutation();
  END IF;
END;
$$;
