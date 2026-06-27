-- Add Cloudinary proof fields to the cycle_payouts table.

ALTER TABLE "cycle_payouts" ADD COLUMN "proof_url" TEXT;
ALTER TABLE "cycle_payouts" ADD COLUMN "resource_type" VARCHAR(20);
ALTER TABLE "cycle_payouts" ADD COLUMN "file_type" VARCHAR(10);
