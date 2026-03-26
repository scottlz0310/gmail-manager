CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text,
	"labels" jsonb,
	"status" text NOT NULL,
	"action" text,
	"error_message" text,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sync_state" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sync_state" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE "messages" FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON TABLE "sync_state" FROM PUBLIC;
