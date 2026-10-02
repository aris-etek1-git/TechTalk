import { sql } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  uuid,
  varchar,
  text,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }), // nullable: Google-only accounts have no password
  googleId: varchar('google_id', { length: 255 }).unique(),
  githubId: varchar('github_id', { length: 64 }).unique(),
  picture: varchar('picture', { length: 500 }), // avatar URL (Google profile picture)
  // §14 asks for a username: the public handle a profile is addressed by, so a
  // student's link never carries their email. Null until onboarding sets it.
  username: varchar('username', { length: 40 }).unique(),
  role: varchar('role', { length: 20 }).default('user').notNull(), // 'user' or 'admin'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// §8 asks for one Content abstraction every provider normalises into. The
// columns below are what recommendation and deduplication need on top of a
// link: who made it, when it was really published, and the provider's own id.
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
  externalId: varchar('external_id', { length: 120 }),
  author: varchar('author', { length: 160 }),
  publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }),
  durationSeconds: integer('duration_seconds'),
  language: varchar('language', { length: 12 }),
  // Whatever the provider knows that has no column of its own: subscriber
  // counts, subreddit, upvotes, arXiv categories. Never used for authorisation.
  metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  createdAtIdx: index('contents_created_at_idx').on(table.createdAt),
  typeIdx: index('contents_type_idx').on(table.type),
  sourceIdx: index('contents_source_idx').on(table.source),
  // A provider re-listing the same item must not create a second row, even
  // when it hands over a URL that differs by a tracking parameter.
  sourceExternalIdx: uniqueIndex('contents_source_external_idx').on(table.source, table.externalId),
}));

export const bookmarks = pgTable('bookmarks', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  contentId: uuid('content_id').references(() => contents.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userContentUniqueIdx: uniqueIndex('bookmarks_user_content_unique_idx').on(table.userId, table.contentId),
}));

// A bookmark means "read it later"; a like is the user affirming the content
// itself. Both are per-user, idempotent, and survive a session change.
export const likes = pgTable('likes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  contentId: uuid('content_id').references(() => contents.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userContentUniqueIdx: uniqueIndex('likes_user_content_unique_idx').on(table.userId, table.contentId),
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
  // §22 identity fields. City lives on campuses too: a school is listed by its
  // headquarters, a campus by where its students actually meet.
  city: varchar('city', { length: 100 }),
  country: varchar('country', { length: 80 }),
  website: varchar('website', { length: 300 }),
  logo: varchar('logo', { length: 500 }),
  description: text('description'),
  // §25: verified is granted by a platform admin, never self-declared, and the
  // date it was granted is what makes "SOURCE: etablissement" an auditable claim.
  verified: boolean('verified').notNull().default(false),
  verifiedAt: timestamp('verified_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
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
  // §23 places a course under one semester. Nullable: the catalog was built
  // before the hierarchy existed, and a course may legitimately be unassigned.
  semesterId: uuid('semester_id').references(() => semesters.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 160 }).notNull(),
  slug: varchar('slug', { length: 160 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orgSlugUniqueIdx: uniqueIndex('courses_organization_slug_unique_idx').on(table.organizationId, table.slug),
  semesterIdx: index('courses_semester_idx').on(table.semesterId),
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
// Groups are anchored on a single campus: meeting people only makes sense
// locally, so unlike past papers they never cross cities. Events can also be
// school-wide or platform-wide (§44), so their campus is optional.
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

export const EVENT_KINDS = [
  'meetup',
  'workshop',
  'hackathon',
  'conference',
  'competition',
  'academic',
] as const;

export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),
  // Exactly one scope owns an event: campus, organization, or neither, which
  // means TechTalk itself published it. The API enforces the choice.
  campusId: uuid('campus_id').references(() => campuses.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  // A group can host an event; deleting the group must not delete the meeting.
  groupId: uuid('group_id').references(() => groups.id, { onDelete: 'set null' }),
  kind: varchar('kind', { length: 24 }).notNull().default('meetup'),
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
  organizationIdx: index('events_organization_idx').on(table.organizationId, table.startsAt),
  kindStartsIdx: index('events_kind_starts_at_idx').on(table.kind, table.startsAt),
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

// --- Taxonomy (§9) -------------------------------------------------------
// Tags are rows, not strings, so a user interest, a course topic and a
// content label all resolve to the same identifier and can be compared.
export const TAG_KINDS = ['topic', 'skill', 'language', 'tool'] as const;
export type TagKind = (typeof TAG_KINDS)[number];

export const tags = pgTable('tags', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: varchar('slug', { length: 60 }).notNull().unique(),
  name: varchar('name', { length: 60 }).notNull(),
  kind: varchar('kind', { length: 20 }).notNull().default('topic'),
  // Denormalised so Explore can order by tag weight without a count(*) scan.
  usageCount: integer('usage_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const contentTags = pgTable('content_tags', {
  id: uuid('id').defaultRandom().primaryKey(),
  contentId: uuid('content_id').references(() => contents.id, { onDelete: 'cascade' }).notNull(),
  tagId: uuid('tag_id').references(() => tags.id, { onDelete: 'cascade' }).notNull(),
}, (table) => ({
  contentTagUniqueIdx: uniqueIndex('content_tags_content_tag_unique_idx').on(table.contentId, table.tagId),
  // Tag-first: this is the lookup a recommendation pass makes.
  tagIdx: index('content_tags_tag_idx').on(table.tagId, table.contentId),
}));

// --- User domain (§14-§17, §48) -----------------------------------------
export const USER_LEVELS = ['beginner', 'intermediate', 'advanced', 'professional'] as const;
export const VISIBILITIES = ['public', 'private', 'school_only'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

// Everything pedagogical hangs off this row: level, goals, and whether the
// profile is exposed. §48 makes the default private, never public.
export const userProfiles = pgTable('user_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  bio: text('bio'),
  level: varchar('level', { length: 20 }).notNull().default('beginner'),
  learningGoals: text('learning_goals').array().notNull().default(sql`'{}'::text[]`),
  preferredLanguages: text('preferred_languages').array().notNull().default(sql`'{}'::text[]`),
  visibility: varchar('visibility', { length: 16 }).notNull().default('private'),
  // Null until the onboarding flow of §16 is finished or explicitly skipped.
  onboardedAt: timestamp('onboarded_at'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const userInterests = pgTable('user_interests', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tagId: uuid('tag_id').references(() => tags.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userTagUniqueIdx: uniqueIndex('user_interests_user_tag_unique_idx').on(table.userId, table.tagId),
  tagIdx: index('user_interests_tag_idx').on(table.tagId),
}));

// Feed and notification switches, kept as one document per user: the shape
// changes with the product and no query ever filters on the inside of it.
export const userPreferences = pgTable('user_preferences', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  settings: jsonb('settings').notNull().default(sql`'{}'::jsonb`),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// §54 lists oauth_accounts separately from users: one identity can hold a
// Google and an Apple credential, and the raw profile stays out of users.
export const OAUTH_PROVIDERS = ['google', 'apple', 'github'] as const;

export const oauthAccounts = pgTable('oauth_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  provider: varchar('provider', { length: 20 }).notNull(),
  providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  // Hashed at rest; a refresh token must never be readable from a dump.
  refreshToken: text('refresh_token'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  providerAccountUniqueIdx: uniqueIndex('oauth_accounts_provider_account_unique_idx').on(
    table.provider,
    table.providerAccountId
  ),
  userIdx: index('oauth_accounts_user_idx').on(table.userId),
}));

// --- Behaviour (§13, §80) ------------------------------------------------
export const INTERACTION_TYPES = [
  'view',
  'like',
  'unlike',
  'save',
  'unsave',
  'share',
  'click',
  'skip',
  'open_external',
] as const;
export type InteractionType = (typeof INTERACTION_TYPES)[number];

// Append-only. likes/bookmarks/reading_history stay as the current-state
// tables the UI reads; this is the history the future model trains on, so a
// like and the unlike that follows it must both survive here.
export const interactions = pgTable('interactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  contentId: uuid('content_id').references(() => contents.id, { onDelete: 'cascade' }).notNull(),
  type: varchar('type', { length: 24 }).notNull(),
  watchTimeSeconds: integer('watch_time_seconds'),
  // 0..1 of the item actually consumed, not a percentage.
  completionRate: real('completion_rate'),
  // Which surface produced the signal: feed, shorts, search, content, push.
  surface: varchar('surface', { length: 24 }),
  context: jsonb('context').notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  userContentIdx: index('interactions_user_content_idx').on(table.userId, table.contentId),
  userTypeIdx: index('interactions_user_type_idx').on(table.userId, table.type),
  createdIdx: index('interactions_created_at_idx').on(table.createdAt),
}));

// --- Collections (§46) ---------------------------------------------------
export const collections = pgTable('collections', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 80 }).notNull(),
  slug: varchar('slug', { length: 80 }).notNull(),
  description: text('description'),
  visibility: varchar('visibility', { length: 16 }).notNull().default('private'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userSlugUniqueIdx: uniqueIndex('collections_user_slug_unique_idx').on(table.userId, table.slug),
}));

export const collectionItems = pgTable('collection_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  collectionId: uuid('collection_id').references(() => collections.id, { onDelete: 'cascade' }).notNull(),
  contentId: uuid('content_id').references(() => contents.id, { onDelete: 'cascade' }).notNull(),
  note: text('note'),
  addedAt: timestamp('added_at').defaultNow().notNull(),
}, (table) => ({
  collectionContentUniqueIdx: uniqueIndex('collection_items_collection_content_unique_idx').on(
    table.collectionId,
    table.contentId
  ),
  contentIdx: index('collection_items_content_idx').on(table.contentId),
}));

// --- Related content (§38) ----------------------------------------------
// The graph behind a learning path. Direction matters: `next` from A to B does
// not imply B points back at A, so the pair is stored once, ordered.
export const RELATION_KINDS = ['related', 'prerequisite', 'next', 'practice', 'build'] as const;

export const contentRelations = pgTable('content_relations', {
  id: uuid('id').defaultRandom().primaryKey(),
  fromContentId: uuid('from_content_id').references(() => contents.id, { onDelete: 'cascade' }).notNull(),
  toContentId: uuid('to_content_id').references(() => contents.id, { onDelete: 'cascade' }).notNull(),
  kind: varchar('kind', { length: 20 }).notNull().default('related'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  pairUniqueIdx: uniqueIndex('content_relations_pair_unique_idx').on(
    table.fromContentId,
    table.toContentId,
    table.kind
  ),
  // Reads go from a content to its neighbours, so `from` must lead the index.
  fromIdx: index('content_relations_from_idx').on(table.fromContentId, table.kind),
}));
// --- School hierarchy (§23-§25) ------------------------------------------
// §54 names this table school_admins. It attaches to the organization rather
// than a campus because a SCHOOL_ADMIN publishes the catalog and announcements
// for every city at once (§24).
export const organizationAdmins = pgTable('organization_admins', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orgUserUniqueIdx: uniqueIndex('organization_admins_org_user_unique_idx').on(table.organizationId, table.userId),
  userIdx: index('organization_admins_user_idx').on(table.userId),
}));

// School -> Program -> Year -> Semester -> Course -> Topics -> Skills. Each
// level is its own row because the campus UI filters on one at a time, and a
// transcript has to name the semester a course belonged to.
export const programs = pgTable('programs', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 140 }).notNull(),
  slug: varchar('slug', { length: 140 }).notNull(),
  description: text('description'),
  // Free label: 'bachelor', 'master', 'cycle ingenieur' differ per country.
  degree: varchar('degree', { length: 40 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orgSlugUniqueIdx: uniqueIndex('programs_organization_slug_unique_idx').on(table.organizationId, table.slug),
}));

export const programYears = pgTable('program_years', {
  id: uuid('id').defaultRandom().primaryKey(),
  programId: uuid('program_id').references(() => programs.id, { onDelete: 'cascade' }).notNull(),
  // 1..5: the number students speak of ("Année 2"). The label is what the UI prints.
  number: integer('number').notNull(),
  label: varchar('label', { length: 80 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  programNumberUniqueIdx: uniqueIndex('program_years_program_number_unique_idx').on(table.programId, table.number),
}));

export const semesters = pgTable('semesters', {
  id: uuid('id').defaultRandom().primaryKey(),
  yearId: uuid('year_id').references(() => programYears.id, { onDelete: 'cascade' }).notNull(),
  number: integer('number').notNull(),
  // 'S1', 'T1', 'Semestre A' — schools name periods differently, so the label
  // is stored instead of derived from the number.
  label: varchar('label', { length: 24 }).notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true, mode: 'date' }),
  endsAt: timestamp('ends_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  yearNumberUniqueIdx: uniqueIndex('semesters_year_number_unique_idx').on(table.yearId, table.number),
}));

// Course -> Topics -> Skills all resolve through tags (§9), so a topic a
// student follows, a skill they progress in and a tag on a YouTube video are
// the same row and can be matched without string comparison.
export const courseTopics = pgTable('course_topics', {
  id: uuid('id').defaultRandom().primaryKey(),
  courseId: uuid('course_id').references(() => courses.id, { onDelete: 'cascade' }).notNull(),
  tagId: uuid('tag_id').references(() => tags.id, { onDelete: 'cascade' }).notNull(),
}, (table) => ({
  courseTagUniqueIdx: uniqueIndex('course_topics_course_tag_unique_idx').on(table.courseId, table.tagId),
  tagIdx: index('course_topics_tag_idx').on(table.tagId, table.courseId),
}));

// §27 progression is per topic or skill, not per course: a self-taught student
// keeps their percentages with no campus attached at all.
export const skillProgress = pgTable('skill_progress', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tagId: uuid('tag_id').references(() => tags.id, { onDelete: 'cascade' }).notNull(),
  // 0..1, not a percentage, so it can be averaged with model output later.
  progress: real('progress').notNull().default(0),
  // 'declared' is the student's own claim, 'estimated' comes from activity,
  // 'validated' was confirmed by an exercise or the school. The UI must say
  // which one it is showing; presenting a claim as a validation is a lie.
  status: varchar('status', { length: 16 }).notNull().default('declared'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userTagUniqueIdx: uniqueIndex('skill_progress_user_tag_unique_idx').on(table.userId, table.tagId),
  userStatusIdx: index('skill_progress_user_status_idx').on(table.userId, table.status),
}));
// --- Projects (§18, §55) --------------------------------------------------
export const PROJECT_STATUSES = ['idea', 'planned', 'in_progress', 'completed', 'abandoned'] as const;

// A project is the proof §19 asks for: someone built this. Ownership lives on
// the row so a listing query never needs the membership table.
export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 140 }).notNull(),
  description: text('description'),
  technologies: text('technologies').array().notNull().default(sql`'{}'::text[]`),
  repositoryUrl: varchar('repository_url', { length: 512 }),
  demoUrl: varchar('demo_url', { length: 512 }),
  status: varchar('status', { length: 20 }).notNull().default('idea'),
  // §48: nothing a student built is published until they say so.
  visibility: varchar('visibility', { length: 16 }).notNull().default('private'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdx: index('projects_user_idx').on(table.userId),
  statusIdx: index('projects_status_visibility_idx').on(table.status, table.visibility),
}));

// §55 lists Owner and Members separately. The owner is not duplicated here;
// this table holds the people who contributed.
export const projectMembers = pgTable('project_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('contributor'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  projectUserUniqueIdx: uniqueIndex('project_members_project_user_unique_idx').on(table.projectId, table.userId),
  userIdx: index('project_members_user_idx').on(table.userId),
}));

// --- Tutors (§28-§30) -----------------------------------------------------
// Subjects and skills both point at tags, so "Algorithmique" filters tutors,
// matches content and feeds progression with one identifier.
export const tutors = pgTable('tutors', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  bio: text('bio'),
  // Whole years of experience: a count is comparable and honest, a free sentence is not.
  experienceYears: integer('experience_years').notNull().default(0),
  // Minor units (cents) — a float price drifts and someone has to eat the error.
  hourlyRateCents: integer('hourly_rate_cents'),
  currency: varchar('currency', { length: 3 }).notNull().default('EUR'),
  languages: text('languages').array().notNull().default(sql`'{}'::text[]`),
  online: boolean('online').notNull().default(true),
  inPerson: boolean('in_person').notNull().default(false),
  // Granted by a moderator after checking identity; never self-declared (§25 logic).
  verified: boolean('verified').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  onlineIdx: index('tutors_online_in_person_idx').on(table.online, table.inPerson),
  rateIdx: index('tutors_hourly_rate_idx').on(table.hourlyRateCents),
}));

export const tutorSubjects = pgTable('tutor_subjects', {
  id: uuid('id').defaultRandom().primaryKey(),
  tutorId: uuid('tutor_id').references(() => tutors.id, { onDelete: 'cascade' }).notNull(),
  tagId: uuid('tag_id').references(() => tags.id, { onDelete: 'cascade' }).notNull(),
}, (table) => ({
  tutorTagUniqueIdx: uniqueIndex('tutor_subjects_tutor_tag_unique_idx').on(table.tutorId, table.tagId),
  // Tag-first: a subject search is "which tutors teach this".
  tagIdx: index('tutor_subjects_tag_idx').on(table.tagId, table.tutorId),
}));

// Recurring weekly windows, stored as local wall-clock times with the tutor's
// timezone. A booking converts them; storing UTC instants here would make the
// same tutor available at different hours every week.
export const tutorAvailability = pgTable('tutor_availability', {
  id: uuid('id').defaultRandom().primaryKey(),
  tutorId: uuid('tutor_id').references(() => tutors.id, { onDelete: 'cascade' }).notNull(),
  // 0 = Sunday .. 6 = Saturday, matching Date.getDay().
  dayOfWeek: integer('day_of_week').notNull(),
  startTime: varchar('start_time', { length: 5 }).notNull(),
  endTime: varchar('end_time', { length: 5 }).notNull(),
  timezone: varchar('timezone', { length: 60 }).notNull().default('Europe/Paris'),
}, (table) => ({
  slotUniqueIdx: uniqueIndex('tutor_availability_tutor_day_start_unique_idx').on(
    table.tutorId,
    table.dayOfWeek,
    table.startTime
  ),
  tutorDayIdx: index('tutor_availability_tutor_day_idx').on(table.tutorId, table.dayOfWeek),
}));

// §30 stops at booking plus confirmation: the lesson itself happens on an
// external tool, so no room, recording or payment state belongs here.
export const BOOKING_STATUSES = ['requested', 'confirmed', 'cancelled', 'completed'] as const;

export const tutorBookings = pgTable('tutor_bookings', {
  id: uuid('id').defaultRandom().primaryKey(),
  tutorId: uuid('tutor_id').references(() => tutors.id, { onDelete: 'cascade' }).notNull(),
  studentId: uuid('student_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  subjectTagId: uuid('subject_tag_id').references(() => tags.id, { onDelete: 'set null' }),
  startsAt: timestamp('starts_at', { withTimezone: true, mode: 'date' }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true, mode: 'date' }).notNull(),
  mode: varchar('mode', { length: 16 }).notNull().default('online'),
  status: varchar('status', { length: 20 }).notNull().default('requested'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  studentIdx: index('tutor_bookings_student_starts_idx').on(table.studentId, table.startsAt),
  tutorIdx: index('tutor_bookings_tutor_starts_idx').on(table.tutorId, table.startsAt),
  statusIdx: index('tutor_bookings_status_idx').on(table.status),
}));

// --- Opportunities (§31) --------------------------------------------------
export const OPPORTUNITY_TYPES = [
  'internship',
  'job',
  'scholarship',
  'fellowship',
  'competition',
  'hackathon',
  'research',
  'conference',
] as const;

export const opportunities = pgTable('opportunities', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: varchar('type', { length: 24 }).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  // Free text: the hiring entity is usually not a registered organization here.
  organization: varchar('organization', { length: 180 }).notNull(),
  description: text('description'),
  deadline: timestamp('deadline', { withTimezone: true, mode: 'date' }),
  location: varchar('location', { length: 200 }),
  remote: boolean('remote').notNull().default(false),
  requirements: text('requirements'),
  skills: text('skills').array().notNull().default(sql`'{}'::text[]`),
  url: varchar('url', { length: 512 }).notNull(),
  source: varchar('source', { length: 80 }).notNull().default('techtalk'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  urlUniqueIdx: uniqueIndex('opportunities_url_unique_idx').on(table.url),
  // The two listings every Opportunities screen asks for.
  typeDeadlineIdx: index('opportunities_type_deadline_idx').on(table.type, table.deadline),
  deadlineIdx: index('opportunities_deadline_idx').on(table.deadline),
}));

// --- Notifications (§45) ---------------------------------------------------
export const NOTIFICATION_TYPES = [
  'recommendation',
  'event',
  'deadline',
  'reply',
  'booking',
  'school_announcement',
  'creator_upload',
] as const;

export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  type: varchar('type', { length: 32 }).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  body: text('body'),
  url: varchar('url', { length: 500 }),
  // null means unread. A boolean would force a second column to say when it
  // was read, and the bell needs the timestamp to sort.
  readAt: timestamp('read_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  // Unread-first: the badge count and the list share this ordering.
  userCreatedIdx: index('notifications_user_created_idx').on(table.userId, table.createdAt),
  userReadIdx: index('notifications_user_read_idx').on(table.userId, table.readAt),
}));

// --- Moderation (§65) -----------------------------------------------------
export const REPORT_REASONS = [
  'spam',
  'harassment',
  'misinformation',
  'copyright',
  'inappropriate',
  'other',
] as const;

// targetId is polymorphic on purpose: a report can concern a user, a content,
// an event or a document, and a moderation queue is one list, not four.
export const reports = pgTable('reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  reporterId: uuid('reporter_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  targetType: varchar('target_type', { length: 20 }).notNull(),
  targetId: uuid('target_id').notNull(),
  reason: varchar('reason', { length: 24 }).notNull(),
  details: text('details'),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewNote: text('review_note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
}, (table) => ({
  statusIdx: index('reports_status_created_idx').on(table.status, table.createdAt),
  targetIdx: index('reports_target_idx').on(table.targetType, table.targetId),
  reporterIdx: index('reports_reporter_idx').on(table.reporterId),
}));

// Block hides someone entirely; mute keeps them visible but silent (§65 lists
// them as different powers), so they share a table and differ by kind.
export const userBlocks = pgTable('user_blocks', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  blockedUserId: uuid('blocked_user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  kind: varchar('kind', { length: 12 }).notNull().default('block'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userTargetKindUniqueIdx: uniqueIndex('user_blocks_user_blocked_kind_unique_idx').on(
    table.userId,
    table.blockedUserId,
    table.kind
  ),
  userIdx: index('user_blocks_user_idx').on(table.userId, table.kind),
}));

// --- Audit (§62) -----------------------------------------------------------
// Append-only, and the actor survives their own deletion: an audit trail that
// loses who did something when the account goes is not an audit trail.
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 60 }).notNull(),
  targetType: varchar('target_type', { length: 32 }),
  targetId: uuid('target_id'),
  metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
  ipAddress: varchar('ip_address', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  actorIdx: index('audit_logs_actor_created_idx').on(table.actorId, table.createdAt),
  targetIdx: index('audit_logs_target_idx').on(table.targetType, table.targetId),
  actionIdx: index('audit_logs_action_idx').on(table.action),
}));
