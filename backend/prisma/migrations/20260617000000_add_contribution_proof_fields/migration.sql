-- Add Cloudinary proof fields to the contributions table and a unique
-- constraint so a member has at most one contribution per (cycle, round).

-- AlterTable
ALTER TABLE "contributions" ADD COLUMN "proof_url" TEXT;
ALTER TABLE "contributions" ADD COLUMN "resource_type" VARCHAR(20);
ALTER TABLE "contributions" ADD COLUMN "file_type" VARCHAR(10);
ALTER TABLE "contributions" ADD COLUMN "notes" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "contributions_cycle_id_round_id_member_id_key" ON "contributions"("cycle_id", "round_id", "member_id");
