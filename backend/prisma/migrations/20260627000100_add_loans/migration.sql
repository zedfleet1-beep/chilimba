-- Loans and repayments for group member lending.

CREATE TYPE "LoanStatus" AS ENUM ('pending', 'approved', 'active', 'repaid', 'rejected', 'defaulted');

CREATE TABLE "loans" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "amount_ngwe" BIGINT NOT NULL,
    "interest_rate" DECIMAL(5,4) NOT NULL,
    "total_due_ngwe" BIGINT NOT NULL,
    "amount_repaid_ngwe" BIGINT NOT NULL DEFAULT 0,
    "status" "LoanStatus" NOT NULL DEFAULT 'pending',
    "purpose" TEXT,
    "requested_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMPTZ,
    "approved_by" TEXT,
    "disbursed_at" TIMESTAMPTZ,
    "due_date" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "loan_repayments" (
    "id" TEXT NOT NULL,
    "loan_id" TEXT NOT NULL,
    "amount_ngwe" BIGINT NOT NULL,
    "paid_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_repayments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "loans_group_id_status_idx" ON "loans"("group_id", "status");
CREATE INDEX "loans_member_id_status_idx" ON "loans"("member_id", "status");
CREATE INDEX "loan_repayments_loan_id_idx" ON "loan_repayments"("loan_id");

ALTER TABLE "loans" ADD CONSTRAINT "loans_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "loans" ADD CONSTRAINT "loans_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "group_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "loans" ADD CONSTRAINT "loans_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;