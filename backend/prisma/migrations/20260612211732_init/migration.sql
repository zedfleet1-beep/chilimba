-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('member', 'super_admin');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('signup', 'password_reset');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('pending', 'paid', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentProofStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "GroupStatus" AS ENUM ('active', 'suspended', 'closed');

-- CreateEnum
CREATE TYPE "GroupTemplate" AS ENUM ('rotating_cash', 'grocery', 'custom');

-- CreateEnum
CREATE TYPE "GroupMemberRole" AS ENUM ('owner', 'treasurer', 'member');

-- CreateEnum
CREATE TYPE "GroupMemberStatus" AS ENUM ('active', 'suspended', 'exited');

-- CreateEnum
CREATE TYPE "ContributionFrequency" AS ENUM ('weekly', 'fortnightly', 'monthly');

-- CreateEnum
CREATE TYPE "PayoutMethod" AS ENUM ('queue', 'random', 'manual', 'voting');

-- CreateEnum
CREATE TYPE "CycleStatus" AS ENUM ('open', 'in_progress', 'completed');

-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('pending', 'collecting', 'paid_out', 'completed');

-- CreateEnum
CREATE TYPE "ContributionStatus" AS ENUM ('pending', 'paid', 'late', 'waived');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('welcome', 'otp', 'invoice_created', 'pop_approved', 'pop_rejected', 'contribution_reminder', 'contribution_received', 'payout', 'renewal', 'monthly_summary');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('queued', 'sent', 'failed');

-- CreateEnum
CREATE TYPE "WhatsappLogStatus" AS ENUM ('sent', 'delivered', 'read', 'failed');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "email" VARCHAR(255),
    "password_hash" TEXT NOT NULL,
    "otp_verified" BOOLEAN NOT NULL DEFAULT false,
    "role" "UserRole" NOT NULL DEFAULT 'member',
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otps" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoice_number" VARCHAR(20) NOT NULL,
    "customer_name" VARCHAR(200) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "email" VARCHAR(255),
    "amount_ngwe" BIGINT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'pending',
    "description" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_proofs" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "file_key" TEXT NOT NULL,
    "file_type" VARCHAR(10) NOT NULL,
    "status" "PaymentProofStatus" NOT NULL DEFAULT 'pending',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMPTZ,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_proofs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "invoice_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "status" "GroupStatus" NOT NULL DEFAULT 'active',
    "template" "GroupTemplate" NOT NULL,
    "country" VARCHAR(10) NOT NULL DEFAULT 'ZM',
    "currency" VARCHAR(10) NOT NULL DEFAULT 'ZMW',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_settings" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "max_members" INTEGER NOT NULL DEFAULT 20,
    "contribution_amount_ngwe" BIGINT NOT NULL,
    "contribution_frequency" "ContributionFrequency" NOT NULL DEFAULT 'monthly',
    "grace_period_days" INTEGER NOT NULL DEFAULT 5,
    "late_penalty_ngwe" BIGINT NOT NULL DEFAULT 0,
    "payout_recipients_count" INTEGER NOT NULL DEFAULT 1,
    "payout_method" "PayoutMethod" NOT NULL DEFAULT 'queue',
    "allow_loans" BOOLEAN NOT NULL DEFAULT false,
    "max_loan_multiplier" DECIMAL(4,2) NOT NULL DEFAULT 3.0,
    "loan_interest_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.20,
    "absence_penalty_ngwe" BIGINT NOT NULL DEFAULT 0,
    "exit_penalty_percent" DECIMAL(5,4) NOT NULL DEFAULT 0.20,
    "whatsapp_reminders" BOOLEAN NOT NULL DEFAULT true,
    "reminder_days_before" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "group_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_members" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "GroupMemberRole" NOT NULL DEFAULT 'member',
    "status" "GroupMemberStatus" NOT NULL DEFAULT 'active',
    "payout_position" INTEGER,
    "joined_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exited_at" TIMESTAMPTZ,

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycles" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "cycle_number" INTEGER NOT NULL,
    "status" "CycleStatus" NOT NULL DEFAULT 'open',
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle_rounds" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "round_number" INTEGER NOT NULL,
    "due_date" DATE NOT NULL,
    "status" "RoundStatus" NOT NULL DEFAULT 'pending',
    "total_collected_ngwe" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cycle_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle_payouts" (
    "id" TEXT NOT NULL,
    "round_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "amount_ngwe" BIGINT NOT NULL,
    "paid_at" TIMESTAMPTZ,
    "proof_key" TEXT,
    "notes" TEXT,

    CONSTRAINT "cycle_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contributions" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "round_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "amount_ngwe" BIGINT NOT NULL,
    "due_date" DATE NOT NULL,
    "paid_date" DATE,
    "status" "ContributionStatus" NOT NULL DEFAULT 'pending',
    "proof_key" TEXT,
    "recorded_by" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "group_id" TEXT,
    "type" "NotificationType" NOT NULL,
    "channel" VARCHAR(20) NOT NULL DEFAULT 'whatsapp',
    "status" "NotificationStatus" NOT NULL DEFAULT 'queued',
    "message" TEXT NOT NULL,
    "sent_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_logs" (
    "id" TEXT NOT NULL,
    "notification_id" TEXT,
    "to_phone" VARCHAR(20) NOT NULL,
    "message" TEXT NOT NULL,
    "evolution_response" JSONB,
    "status" "WhatsappLogStatus" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "otps_user_id_used_idx" ON "otps"("user_id", "used");

-- CreateIndex
CREATE INDEX "otps_expires_at_idx" ON "otps"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_phone_idx" ON "invoices"("phone");

-- CreateIndex
CREATE INDEX "payment_proofs_invoice_id_status_idx" ON "payment_proofs"("invoice_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "groups_invoice_id_key" ON "groups"("invoice_id");

-- CreateIndex
CREATE INDEX "groups_owner_id_idx" ON "groups"("owner_id");

-- CreateIndex
CREATE INDEX "groups_status_idx" ON "groups"("status");

-- CreateIndex
CREATE UNIQUE INDEX "group_settings_group_id_key" ON "group_settings"("group_id");

-- CreateIndex
CREATE INDEX "group_members_group_id_status_idx" ON "group_members"("group_id", "status");

-- CreateIndex
CREATE INDEX "group_members_group_id_payout_position_idx" ON "group_members"("group_id", "payout_position");

-- CreateIndex
CREATE UNIQUE INDEX "group_members_group_id_user_id_key" ON "group_members"("group_id", "user_id");

-- CreateIndex
CREATE INDEX "cycles_group_id_status_idx" ON "cycles"("group_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "cycles_group_id_cycle_number_key" ON "cycles"("group_id", "cycle_number");

-- CreateIndex
CREATE INDEX "cycle_rounds_due_date_idx" ON "cycle_rounds"("due_date");

-- CreateIndex
CREATE UNIQUE INDEX "cycle_rounds_cycle_id_round_number_key" ON "cycle_rounds"("cycle_id", "round_number");

-- CreateIndex
CREATE INDEX "cycle_payouts_round_id_idx" ON "cycle_payouts"("round_id");

-- CreateIndex
CREATE UNIQUE INDEX "cycle_payouts_round_id_member_id_key" ON "cycle_payouts"("round_id", "member_id");

-- CreateIndex
CREATE INDEX "contributions_group_id_status_idx" ON "contributions"("group_id", "status");

-- CreateIndex
CREATE INDEX "contributions_cycle_id_member_id_idx" ON "contributions"("cycle_id", "member_id");

-- CreateIndex
CREATE INDEX "contributions_round_id_member_id_idx" ON "contributions"("round_id", "member_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_status_idx" ON "notifications"("user_id", "status");

-- CreateIndex
CREATE INDEX "notifications_group_id_status_idx" ON "notifications"("group_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_logs_notification_id_key" ON "whatsapp_logs"("notification_id");

-- CreateIndex
CREATE INDEX "whatsapp_logs_status_created_at_idx" ON "whatsapp_logs"("status", "created_at");

-- CreateIndex
CREATE INDEX "whatsapp_logs_to_phone_idx" ON "whatsapp_logs"("to_phone");

-- AddForeignKey
ALTER TABLE "otps" ADD CONSTRAINT "otps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_settings" ADD CONSTRAINT "group_settings_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycles" ADD CONSTRAINT "cycles_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_rounds" ADD CONSTRAINT "cycle_rounds_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_payouts" ADD CONSTRAINT "cycle_payouts_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "cycle_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_payouts" ADD CONSTRAINT "cycle_payouts_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "group_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "cycle_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "group_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_logs" ADD CONSTRAINT "whatsapp_logs_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
