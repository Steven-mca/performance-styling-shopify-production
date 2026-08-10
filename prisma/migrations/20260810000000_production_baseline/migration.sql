CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Agreement" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "creatorName" TEXT NOT NULL,
    "creatorEmail" TEXT NOT NULL,
    "socialHandle" TEXT,
    "vehicle" TEXT NOT NULL,
    "wheelSpecification" TEXT NOT NULL,
    "deliverables" TEXT NOT NULL,
    "terms" TEXT NOT NULL,
    "wheelValuePence" INTEGER NOT NULL,
    "contributionPence" INTEGER NOT NULL,
    "salesTarget" INTEGER NOT NULL,
    "refundPence" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AWAITING_CREATOR',
    "creatorSignature" TEXT,
    "creatorSignedName" TEXT,
    "creatorSignedAt" TIMESTAMP(3),
    "companySignature" TEXT,
    "companySignedName" TEXT,
    "companySignedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Agreement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Agreement_reference_key" ON "Agreement"("reference");
CREATE UNIQUE INDEX "Agreement_accessToken_key" ON "Agreement"("accessToken");
CREATE INDEX "Agreement_shop_status_idx" ON "Agreement"("shop", "status");
