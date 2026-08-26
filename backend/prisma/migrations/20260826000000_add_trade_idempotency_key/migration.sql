-- Add a client-supplied idempotency key to Trade so a request retry that
-- generates a fresh tradeId cannot create a second row for the same
-- logical creation request.
ALTER TABLE "Trade" ADD COLUMN "idempotencyKey" VARCHAR(255);

CREATE UNIQUE INDEX "Trade_idempotencyKey_key" ON "Trade"("idempotencyKey");
