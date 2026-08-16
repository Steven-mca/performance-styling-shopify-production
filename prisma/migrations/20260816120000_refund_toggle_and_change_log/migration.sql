ALTER TABLE "Agreement" ADD COLUMN "refundEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "AgreementChange" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "changedBy" TEXT,
    "changes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgreementChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgreementChange_agreementId_createdAt_idx"
ON "AgreementChange"("agreementId", "createdAt");

ALTER TABLE "AgreementChange"
ADD CONSTRAINT "AgreementChange_agreementId_fkey"
FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
