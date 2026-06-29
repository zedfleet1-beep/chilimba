-- Per-group contribution payment account (optional override of platform default).
ALTER TABLE "payment_settings" ADD COLUMN "group_id" TEXT;

CREATE UNIQUE INDEX "payment_settings_group_id_key" ON "payment_settings"("group_id");

CREATE INDEX "payment_settings_group_id_idx" ON "payment_settings"("group_id");

ALTER TABLE "payment_settings" ADD CONSTRAINT "payment_settings_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;