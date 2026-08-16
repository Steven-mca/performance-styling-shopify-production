CREATE TABLE "AgreementDefault" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "deliverables" TEXT NOT NULL,
    "terms" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgreementDefault_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgreementDefault_shop_key" ON "AgreementDefault"("shop");
