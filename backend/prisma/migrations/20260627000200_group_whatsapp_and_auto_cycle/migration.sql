ALTER TABLE "group_settings" ADD COLUMN "auto_open_next_cycle" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "group_settings" ADD COLUMN "whatsapp_group_jid" VARCHAR(100);