-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('mobile_money', 'bank');

-- CreateEnum
CREATE TYPE "MobileMoneyProvider" AS ENUM ('mtn', 'airtel', 'zamtel');

-- CreateTable
CREATE TABLE "payment_settings" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT,
    "payment_method" "PaymentMethod" NOT NULL,
    "mobile_money_provider" "MobileMoneyProvider",
    "bank_name" TEXT,
    "account_name" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "reference" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "payment_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_settings_invoice_id_key" ON "payment_settings"("invoice_id");

-- CreateIndex
CREATE INDEX "payment_settings_invoice_id_idx" ON "payment_settings"("invoice_id");

-- AddForeignKey
ALTER TABLE "payment_settings" ADD CONSTRAINT "payment_settings_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
