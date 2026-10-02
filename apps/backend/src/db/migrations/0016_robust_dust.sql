CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" varchar(60) NOT NULL,
	"target_type" varchar(32),
	"target_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(32) NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text,
	"url" varchar(500),
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(24) NOT NULL,
	"title" varchar(200) NOT NULL,
	"organization" varchar(180) NOT NULL,
	"description" text,
	"deadline" timestamp with time zone,
	"location" varchar(200),
	"remote" boolean DEFAULT false NOT NULL,
	"requirements" text,
	"skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"url" varchar(512) NOT NULL,
	"source" varchar(80) DEFAULT 'techtalk' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(20) DEFAULT 'contributor' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(140) NOT NULL,
	"description" text,
	"technologies" text[] DEFAULT '{}'::text[] NOT NULL,
	"repository_url" varchar(512),
	"demo_url" varchar(512),
	"status" varchar(20) DEFAULT 'idea' NOT NULL,
	"visibility" varchar(16) DEFAULT 'private' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"target_type" varchar(20) NOT NULL,
	"target_id" uuid NOT NULL,
	"reason" varchar(24) NOT NULL,
	"details" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"review_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tutor_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tutor_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" varchar(5) NOT NULL,
	"end_time" varchar(5) NOT NULL,
	"timezone" varchar(60) DEFAULT 'Europe/Paris' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tutor_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tutor_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"subject_tag_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"mode" varchar(16) DEFAULT 'online' NOT NULL,
	"status" varchar(20) DEFAULT 'requested' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tutor_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tutor_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tutors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"bio" text,
	"experience_years" integer DEFAULT 0 NOT NULL,
	"hourly_rate_cents" integer,
	"currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"languages" text[] DEFAULT '{}'::text[] NOT NULL,
	"online" boolean DEFAULT true NOT NULL,
	"in_person" boolean DEFAULT false NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tutors_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blocked_user_id" uuid NOT NULL,
	"kind" varchar(12) DEFAULT 'block' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reports" ADD CONSTRAINT "reports_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tutor_availability" ADD CONSTRAINT "tutor_availability_tutor_id_tutors_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tutor_bookings" ADD CONSTRAINT "tutor_bookings_tutor_id_tutors_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tutor_bookings" ADD CONSTRAINT "tutor_bookings_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tutor_bookings" ADD CONSTRAINT "tutor_bookings_subject_tag_id_tags_id_fk" FOREIGN KEY ("subject_tag_id") REFERENCES "public"."tags"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tutor_subjects" ADD CONSTRAINT "tutor_subjects_tutor_id_tutors_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tutor_subjects" ADD CONSTRAINT "tutor_subjects_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tutors" ADD CONSTRAINT "tutors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_user_id_users_id_fk" FOREIGN KEY ("blocked_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_actor_created_idx" ON "audit_logs" ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_target_idx" ON "audit_logs" ("target_type","target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs" ("action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_created_idx" ON "notifications" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_read_idx" ON "notifications" ("user_id","read_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "opportunities_url_unique_idx" ON "opportunities" ("url");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opportunities_type_deadline_idx" ON "opportunities" ("type","deadline");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opportunities_deadline_idx" ON "opportunities" ("deadline");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_members_project_user_unique_idx" ON "project_members" ("project_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_members_user_idx" ON "project_members" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_user_idx" ON "projects" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_status_visibility_idx" ON "projects" ("status","visibility");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reports_status_created_idx" ON "reports" ("status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reports_target_idx" ON "reports" ("target_type","target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reports_reporter_idx" ON "reports" ("reporter_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tutor_availability_tutor_day_start_unique_idx" ON "tutor_availability" ("tutor_id","day_of_week","start_time");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tutor_availability_tutor_day_idx" ON "tutor_availability" ("tutor_id","day_of_week");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tutor_bookings_student_starts_idx" ON "tutor_bookings" ("student_id","starts_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tutor_bookings_tutor_starts_idx" ON "tutor_bookings" ("tutor_id","starts_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tutor_bookings_status_idx" ON "tutor_bookings" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tutor_subjects_tutor_tag_unique_idx" ON "tutor_subjects" ("tutor_id","tag_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tutor_subjects_tag_idx" ON "tutor_subjects" ("tag_id","tutor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tutors_online_in_person_idx" ON "tutors" ("online","in_person");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tutors_hourly_rate_idx" ON "tutors" ("hourly_rate_cents");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_blocks_user_blocked_kind_unique_idx" ON "user_blocks" ("user_id","blocked_user_id","kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_blocks_user_idx" ON "user_blocks" ("user_id","kind");