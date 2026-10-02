ALTER TABLE "users" ADD COLUMN "username" varchar(40);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");