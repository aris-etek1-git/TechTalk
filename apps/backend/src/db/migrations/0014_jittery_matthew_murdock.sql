CREATE TABLE IF NOT EXISTS "collection_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"content_id" uuid NOT NULL,
	"note" text,
	"added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"slug" varchar(80) NOT NULL,
	"description" text,
	"visibility" varchar(16) DEFAULT 'private' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "content_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_content_id" uuid NOT NULL,
	"to_content_id" uuid NOT NULL,
	"kind" varchar(20) DEFAULT 'related' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "content_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"content_id" uuid NOT NULL,
	"type" varchar(24) NOT NULL,
	"watch_time_seconds" integer,
	"completion_rate" real,
	"surface" varchar(24),
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "oauth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(20) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"email" varchar(255),
	"refresh_token" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(60) NOT NULL,
	"name" varchar(60) NOT NULL,
	"kind" varchar(20) DEFAULT 'topic' NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_interests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"bio" text,
	"level" varchar(20) DEFAULT 'beginner' NOT NULL,
	"learning_goals" text[] DEFAULT '{}'::text[] NOT NULL,
	"preferred_languages" text[] DEFAULT '{}'::text[] NOT NULL,
	"visibility" varchar(16) DEFAULT 'private' NOT NULL,
	"onboarded_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "contents" ADD COLUMN "external_id" varchar(120);--> statement-breakpoint
ALTER TABLE "contents" ADD COLUMN "author" varchar(160);--> statement-breakpoint
ALTER TABLE "contents" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contents" ADD COLUMN "duration_seconds" integer;--> statement-breakpoint
ALTER TABLE "contents" ADD COLUMN "language" varchar(12);--> statement-breakpoint
ALTER TABLE "contents" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "collections" ADD CONSTRAINT "collections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "content_relations" ADD CONSTRAINT "content_relations_from_content_id_contents_id_fk" FOREIGN KEY ("from_content_id") REFERENCES "public"."contents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "content_relations" ADD CONSTRAINT "content_relations_to_content_id_contents_id_fk" FOREIGN KEY ("to_content_id") REFERENCES "public"."contents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "content_tags" ADD CONSTRAINT "content_tags_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "content_tags" ADD CONSTRAINT "content_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "interactions" ADD CONSTRAINT "interactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "interactions" ADD CONSTRAINT "interactions_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_interests" ADD CONSTRAINT "user_interests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_interests" ADD CONSTRAINT "user_interests_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "collection_items_collection_content_unique_idx" ON "collection_items" ("collection_id","content_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collection_items_content_idx" ON "collection_items" ("content_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "collections_user_slug_unique_idx" ON "collections" ("user_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "content_relations_pair_unique_idx" ON "content_relations" ("from_content_id","to_content_id","kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_relations_from_idx" ON "content_relations" ("from_content_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "content_tags_content_tag_unique_idx" ON "content_tags" ("content_id","tag_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_tags_tag_idx" ON "content_tags" ("tag_id","content_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "interactions_user_content_idx" ON "interactions" ("user_id","content_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "interactions_user_type_idx" ON "interactions" ("user_id","type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "interactions_created_at_idx" ON "interactions" ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "oauth_accounts_provider_account_unique_idx" ON "oauth_accounts" ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_accounts_user_idx" ON "oauth_accounts" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_interests_user_tag_unique_idx" ON "user_interests" ("user_id","tag_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_interests_tag_idx" ON "user_interests" ("tag_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contents_type_idx" ON "contents" ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contents_source_idx" ON "contents" ("source");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "contents_source_external_idx" ON "contents" ("source","external_id");