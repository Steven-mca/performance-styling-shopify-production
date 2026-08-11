ALTER TABLE "Agreement" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "Agreement_shop_archivedAt_idx" ON "Agreement"("shop", "archivedAt");
