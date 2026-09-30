import { sql } from 'drizzle-orm';
import { boolean, integer, pgTable, uuid, varchar, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }), // nullable: Google-only accounts have no password
  googleId: varchar('google_id', { length: 255 }).unique(),
  picture: varchar('picture', { length: 500 }), // avatar URL (Google profile picture)
  role: varchar('role', { length: 20 }).default('user').notNull(), // 'user' or 'admin'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const contents = pgTable('contents', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  url: varchar('url', { length: 512 }).notNull().unique(),
  source: varchar('source', { length: 100 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  summary: text('summary'),
  body: text('body'), // full article content as sanitized HTML
  categories: text('categories').array(),
  image: varchar('image', { length: 1000 }),
  embedCode: text('embed_code'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  createdAtIdx: index('contents_created_at_idx').on(table.createdAt),
}));

export const bookmarks = pgTable('bookmarks', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  contentId: uuid('content_id').references(() => contents.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userContentUniqueIdx: uniqueIndex('bookmarks_user_content_unique_idx').on(table.userId, table.contentId),
}));

export const readingHistory = pgTable('reading_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  contentId: uuid('content_id').references(() => contents.id, { onDelete: 'cascade' }).notNull(),
  readAt: timestamp('read_at').defaultNow().notNull(),
}, (table) => ({
  userContentIdx: index('reading_history_user_content_idx').on(table.userId, table.contentId),
}));

// --- Campus domain -------------------------------------------------------
// A campus is the tenant boundary for every student feature (annales, groups,
// events). Membership carries its own role, independent from the global
// users.role: a campus admin is not a platform admin, and vice versa.
export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  slug: varchar('slug', { length: 120 }).notNull().unique(),
  // School-wide email domains (e.g. ['epitech.eu']) used to prove a student
  // belongs to a private campus. Not verified by sending mail yet.
  emailDomains: text('email_domains').array().notNull().default(sql`'{}'::text[]`),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const campuses = pgTable('campuses', {
  id: uuid('id').defaultRandom().primaryKey(),
  // restrict: deleting an organization that still has campuses must fail loudly
  // instead of silently cascading into memberships and course material.
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'restrict' }).notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  slug: varchar('slug', { length: 140 }).notNull().unique(),
  city: varchar('city', { length: 100 }),
  description: text('description'),
  // Public campuses are discoverable and joinable by anyone; private ones are
  // hidden from search and require a matching organization email domain.
  isPublic: boolean('is_public').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  organizationIdx: index('campuses_organization_idx').on(table.organizationId),
}));

export const campusMembers = pgTable('campus_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  campusId: uuid('campus_id').references(() => campuses.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  role: varchar('role', { length: 20 }).default('member').notNull(), // 'member' | 'moderator' | 'admin'
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (table) => ({
  campusUserUniqueIdx: uniqueIndex('campus_members_campus_user_unique_idx').on(table.campusId, table.userId),
  userIdx: index('campus_members_user_idx').on(table.userId),
}));

// A course is a school-wide catalog entry, not a campus one: the same module is
// taught in several cities, and past papers are worth more shared across them.
export const courses = pgTable('courses', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'restrict' }).notNull(),
  name: varchar('name', { length: 160 }).notNull(),
  slug: varchar('slug', { length: 160 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orgSlugUniqueIdx: uniqueIndex('courses_organization_slug_unique_idx').on(table.organizationId, table.slug),
}));

export const documents = pgTable('documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  courseId: uuid('course_id').references(() => courses.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  // Object key inside the bucket; never exposed to clients as a filesystem path.
  storageKey: varchar('storage_key', { length: 512 }).notNull().unique(),
  checksum: varchar('checksum', { length: 64 }).notNull(),
  fileName: varchar('file_name', { length: 200 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  // 'S1'..'S5' style period and the academic year the paper was set in.
  period: varchar('period', { length: 8 }),
  academicYear: varchar('academic_year', { length: 9 }),
  // Student uploads stay 'pending' until a campus moderator approves them.
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  uploaderId: uuid('uploader_id').references(() => users.id, { onDelete: 'set null' }),
  // Provenance only: dropping a campus must not drop the papers its students shared.
  campusId: uuid('campus_id').references(() => campuses.id, { onDelete: 'set null' }),
  downloads: integer('downloads').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  courseIdx: index('documents_course_idx').on(table.courseId),
  uploaderIdx: index('documents_uploader_idx').on(table.uploaderId),
  // Two students uploading the same scan must not create two entries.
  courseChecksumUniqueIdx: uniqueIndex('documents_course_checksum_unique_idx').on(table.courseId, table.checksum),
}));

// --- Campus life ---------------------------------------------------------
// Groups and events are anchored on a single campus: meeting people only makes
// sense locally, so unlike past papers they never cross cities.
export const groups = pgTable('groups', {
  id: uuid('id').defaultRandom().primaryKey(),
  campusId: uuid('campus_id').references(() => campuses.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  slug: varchar('slug', { length: 140 }).notNull(),
  description: text('description'),
  // Free-form label used for filtering: 'revision', 'projets', 'sport'…
  topic: varchar('topic', { length: 60 }),
  // null means unlimited; otherwise it caps members, not hosts.
  capacity: integer('capacity'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  campusIdx: index('groups_campus_idx').on(table.campusId),
  campusSlugUniqueIdx: uniqueIndex('groups_campus_slug_unique_idx').on(table.campusId, table.slug),
}));

export const groupMembers = pgTable('group_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  groupId: uuid('group_id').references(() => groups.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  role: varchar('role', { length: 20 }).default('member').notNull(), // 'member' | 'host'
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (table) => ({
  groupUserUniqueIdx: uniqueIndex('group_members_group_user_unique_idx').on(table.groupId, table.userId),
  userIdx: index('group_members_user_idx').on(table.userId),
}));

export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),
  campusId: uuid('campus_id').references(() => campuses.id, { onDelete: 'cascade' }).notNull(),
  // A group can host an event; deleting the group must not delete the meeting.
  groupId: uuid('group_id').references(() => groups.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 160 }).notNull(),
  description: text('description'),
  location: varchar('location', { length: 200 }).notNull(),
  // timestamptz: a campus can host students across timezones and an event is an instant.
  startsAt: timestamp('starts_at', { withTimezone: true, mode: 'date' }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true, mode: 'date' }),
  capacity: integer('capacity'),
  // 'cancelled' keeps the row (and its RSVP history) instead of erasing it.
  status: varchar('status', { length: 20 }).default('scheduled').notNull(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  campusStartsIdx: index('events_campus_starts_at_idx').on(table.campusId, table.startsAt),
  groupIdx: index('events_group_idx').on(table.groupId),
}));

export const eventRsvps = pgTable('event_rsvps', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  // Only 'going' occupies a seat; 'interested' is a watch list.
  status: varchar('status', { length: 20 }).default('going').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  eventUserUniqueIdx: uniqueIndex('event_rsvps_event_user_unique_idx').on(table.eventId, table.userId),
  userIdx: index('event_rsvps_user_idx').on(table.userId),
}));
