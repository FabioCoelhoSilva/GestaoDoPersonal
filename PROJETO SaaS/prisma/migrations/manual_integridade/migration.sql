-- Migration manual: integridade multi-tenant e auditoria inalterável.
-- Executar DEPOIS da migration gerada pelo Prisma (prisma migrate dev / deploy).
-- Observação: o Prisma não gera FKs compostas nem CHECK constraints; ao rodar
-- `prisma migrate diff`, esses objetos aparecem como divergência. Não remover.

-- 1) FKs compostas: impedem vínculo entre tenants direto no banco
ALTER TABLE "contracts"
  ADD CONSTRAINT "contracts_student_tenant_fk"
  FOREIGN KEY ("studentId", "personalId") REFERENCES "students" ("id", "personalId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_parcels"
  ADD CONSTRAINT "parcels_contract_tenant_fk"
  FOREIGN KEY ("contractId", "personalId") REFERENCES "contracts" ("id", "personalId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "workouts"
  ADD CONSTRAINT "workouts_student_tenant_fk"
  FOREIGN KEY ("studentId", "personalId") REFERENCES "students" ("id", "personalId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "exams"
  ADD CONSTRAINT "exams_student_tenant_fk"
  FOREIGN KEY ("studentId", "personalId") REFERENCES "students" ("id", "personalId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- studentId é opcional em extra_payments: MATCH SIMPLE ignora a checagem quando é NULL
ALTER TABLE "extra_payments"
  ADD CONSTRAINT "extra_payments_student_tenant_fk"
  FOREIGN KEY ("studentId", "personalId") REFERENCES "students" ("id", "personalId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "leads"
  ADD CONSTRAINT "leads_converted_student_tenant_fk"
  FOREIGN KEY ("convertedStudentId", "personalId") REFERENCES "students" ("id", "personalId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2) Funil: convertido <=> convertedStudentId preenchido
ALTER TABLE "leads"
  ADD CONSTRAINT "leads_conversion_consistency"
  CHECK (("status" = 'CONVERTED') = ("convertedStudentId" IS NOT NULL));

-- 3) Auditoria inalterável: AccessLog é append-only
CREATE OR REPLACE FUNCTION access_logs_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'access_logs é append-only: UPDATE e DELETE são proibidos';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER access_logs_no_update
  BEFORE UPDATE OR DELETE ON "access_logs"
  FOR EACH ROW EXECUTE FUNCTION access_logs_block_mutation();
