-- CreateTable
CREATE TABLE "PlatformFeeEvent" (
    "id" SERIAL NOT NULL,
    "tradeId" VARCHAR(255) NOT NULL,
    "tradeAmountUsdc" VARCHAR(100) NOT NULL,
    "feeUsdc" VARCHAR(100) NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ledgerSequence" INTEGER,

    CONSTRAINT "PlatformFeeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformFeeEvent_tradeId_key" ON "PlatformFeeEvent"("tradeId");

-- CreateIndex
CREATE INDEX "PlatformFeeEvent_collectedAt_idx" ON "PlatformFeeEvent"("collectedAt");

-- CreateIndex
CREATE INDEX "PlatformFeeEvent_tradeId_idx" ON "PlatformFeeEvent"("tradeId");
