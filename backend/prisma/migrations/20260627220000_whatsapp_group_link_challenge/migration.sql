CREATE TABLE "whatsapp_group_link_challenges" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "whatsapp_jid" VARCHAR(100) NOT NULL,
    "whatsapp_subject" VARCHAR(200),
    "code" VARCHAR(10) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_group_link_challenges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "whatsapp_group_link_challenges_group_id_used_idx" ON "whatsapp_group_link_challenges"("group_id", "used");
CREATE INDEX "whatsapp_group_link_challenges_expires_at_idx" ON "whatsapp_group_link_challenges"("expires_at");

ALTER TABLE "whatsapp_group_link_challenges" ADD CONSTRAINT "whatsapp_group_link_challenges_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "whatsapp_group_link_challenges" ADD CONSTRAINT "whatsapp_group_link_challenges_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;