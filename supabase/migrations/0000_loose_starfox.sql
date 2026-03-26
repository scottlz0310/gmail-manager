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
