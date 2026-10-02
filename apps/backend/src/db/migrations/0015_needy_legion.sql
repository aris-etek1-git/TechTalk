CREATE TABLE IF NOT EXISTS "course_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "program_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"label" varchar(80),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(140) NOT NULL,
	"slug" varchar(140) NOT NULL,
	"description" text,
	"degree" varchar(40),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "semesters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"label" varchar(24) NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "skill_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"progress" real DEFAULT 0 NOT NULL,
	"status" varchar(16) DEFAULT 'declared' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "campus_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "semester_id" uuid;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "kind" varchar(24) DEFAULT 'meetup' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "city" varchar(100);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "country" varchar(80);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "website" varchar(300);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "logo" varchar(500);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_topics" ADD CONSTRAINT "course_topics_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_topics" ADD CONSTRAINT "course_topics_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_admins" ADD CONSTRAINT "organization_admins_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_admins" ADD CONSTRAINT "organization_admins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "program_years" ADD CONSTRAINT "program_years_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "programs" ADD CONSTRAINT "programs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "semesters" ADD CONSTRAINT "semesters_year_id_program_years_id_fk" FOREIGN KEY ("year_id") REFERENCES "public"."program_years"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "skill_progress" ADD CONSTRAINT "skill_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "skill_progress" ADD CONSTRAINT "skill_progress_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "course_topics_course_tag_unique_idx" ON "course_topics" ("course_id","tag_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_topics_tag_idx" ON "course_topics" ("tag_id","course_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organization_admins_org_user_unique_idx" ON "organization_admins" ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_admins_user_idx" ON "organization_admins" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "program_years_program_number_unique_idx" ON "program_years" ("program_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "programs_organization_slug_unique_idx" ON "programs" ("organization_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "semesters_year_number_unique_idx" ON "semesters" ("year_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "skill_progress_user_tag_unique_idx" ON "skill_progress" ("user_id","tag_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "skill_progress_user_status_idx" ON "skill_progress" ("user_id","status");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "courses" ADD CONSTRAINT "courses_semester_id_semesters_id_fk" FOREIGN KEY ("semester_id") REFERENCES "public"."semesters"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courses_semester_idx" ON "courses" ("semester_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_organization_idx" ON "events" ("organization_id","starts_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_kind_starts_at_idx" ON "events" ("kind","starts_at");