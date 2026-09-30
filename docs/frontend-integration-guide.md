# TechTalk — API Contract & Frontend Integration Guide

This document defines the HTTP contract between the TechTalk frontend and backend, the data models exposed by the API, and the integration requirements for the presentation layer.

---

## 1. Architectural Context

| Layer | Technology |
| --- | --- |
| Backend | Fastify, TypeScript, Drizzle ORM, PostgreSQL |
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Authentication | Stateful JWT via `@fastify/jwt` (Bearer token) |
| Content aggregation | Automated workers (`node-cron`, hourly) fetching from Dev.to, YouTube Data API v3, and global RSS feeds |
| Base URL | `http://localhost:5000/api` (local) — overridable via `VITE_API_URL` |

### Authentication

All protected endpoints require the header:

```
Authorization: Bearer <jwt_token>
```

Tokens are signed with a 1-day expiration. Access tokens may be renewed via `POST /api/auth/refresh` (see [2.5](#25-refresh-a-token)).

---

## 2. REST API Endpoints

### 2.1 Register a New Account

**`POST /api/auth/register`** — `application/json`

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "secure_password_here"
}
```

**`201 Created`**

```json
{
  "message": "User registered successfully!",
  "user": {
    "id": "a3b89c00-...",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "user",
    "picture": null
  }
}
```

Constraints: email must match a valid format; password must be 12–100 characters and contain at least one uppercase letter, one lowercase letter, one digit, and one special character.

### 2.2 User Login

**`POST /api/auth/login`** — `application/json`

```json
{
  "email": "jane@example.com",
  "password": "secure_password_here"
}
```

**`200 OK`**

```json
{
  "message": "Login successful!",
  "token": "eyJhbGciOiJIUzI1NiIsIn...",
  "user": {
    "id": "a3b89c00-...",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "user",
    "picture": null
  }
}
```

### 2.3 Google Sign-In

**`POST /api/auth/google`** — `application/json`

```json
{
  "credential": "<google_id_token>"
}
```

The ID token is verified against Google's certificate. A new account is created on first sign-in (passwordless). Returns the same shape as [2.2](#22-user-login).

### 2.4 Refresh a Token

**`POST /api/auth/refresh`** — `Bearer <expired_or_valid_token>`

Server-side verification without expiration enforcement, up to a 30-day grace period. Returns the same shape as [2.2](#22-user-login) with a fresh token.

```json
{
  "message": "Token refreshed successfully!",
  "token": "eyJhbGciOiJIUzI1NiIsIn...",
  "user": { "id": "...", "name": "Jane Doe", "email": "jane@example.com", "role": "user", "picture": null }
}
```

### 2.5 Current User & Profile

**`GET /api/auth/me`** — returns `{ "user": { ... } }` (same user shape as above).

**`PATCH /api/auth/profile`** — `application/json`

```json
{ "name": "Jane D." }
```

Returns `{ "message": "Profile updated successfully!", "user": { ... } }`.

> Note: all authentication routes are rate-limited to 20 requests per minute per client.

---

## 3. Content & Feed Module

### 3.1 Fetch Aggregated Feed

**`GET /api/content`** — protected

| Query parameter | Type | Default | Max | Description |
| --- | --- | --- | --- | --- |
| `limit` | number | `50` | `100` | Number of items to return |
| `offset` | number | `0` | — | Number of items to skip |
| `search` | string | — | — | Case-insensitive match on title, summary, or source |
| `type` | string | — | — | `article` `\|` `video` `\|` `social_post` |
| `categories` | string | — | — | Comma-separated list, matches any category |

**`200 OK`** — items ordered by `created_at` descending:

```json
[
  {
    "id": "8f4b23b4-e283-4a6c-941d-d9b8e23f11a4",
    "title": "Understanding TypeScript 5.5 Features",
    "url": "https://dev.to/example/typescript-features",
    "source": "Dev.to",
    "type": "article",
    "summary": "A deep dive into the latest type-checking enhancements...",
    "embedCode": null,
    "createdAt": "2026-06-23T20:44:00.000Z"
  },
  {
    "id": "1c2b3a4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    "title": "Building Next-Gen Robotics with Assembly",
    "url": "https://www.youtube.com/watch?v=robotics-vid",
    "source": "YouTube",
    "type": "video",
    "summary": "A video exploring low-level control systems...",
    "embedCode": "<iframe ...></iframe>",
    "createdAt": "2026-06-23T21:12:00.000Z"
  }
]
```

### 3.2 Create Content (admin)

**`POST /api/content`** — protected, `role: admin`

```json
{
  "title": "My Article",
  "url": "https://example.com/article",
  "source": "Custom",
  "type": "article",
  "summary": "..."
}
```

**`201 Created`** — returns `{ "message": "...", "content": { ... } }`. Duplicate URLs are rejected with `409`.

### 3.3 Bookmarks

| Endpoint | Description |
| --- | --- |
| `GET /api/content/bookmarks` | List the current user's bookmarked content (full content objects) |
| `POST /api/content/bookmarks` | Body `{ "contentId": "..." }` → `201`; idempotent |
| `DELETE /api/content/bookmarks/:contentId` | Remove a bookmark → `200` |

### 3.4 Reading History

| Endpoint | Description |
| --- | --- |
| `POST /api/content/read` | Body `{ "contentId": "..." }` → records a read → `201` |
| `POST /api/content/read/batch` | Body `{ "contentIds": ["...", "..."] }` → bulk sync, skips already-read and unknown ids → `200` |
| `GET /api/content/read` | Returns `{ "readIds": string[], "readDates": string[] }` (ISO dates of first reads) |

---

## 4. Campuses & organizations

A campus is the tenant boundary for student features (past papers, groups, events).
Authorization has two levels: the platform role on the JWT (`user` | `admin`) and a
per-campus role granted by membership (`member` | `moderator` | `admin`). A platform
admin outranks every campus role but does not get a membership row.

### 4.1 Organizations

| Endpoint | Auth | Description |
| --- | --- | --- |
| `GET /api/organizations` | JWT | List schools (`?search=` on name), max 100 |
| `POST /api/organizations` | platform `admin` | Body `{ name, slug?, emailDomains? }` → `201`. Slugs are unique → `409` |

### 4.2 Campuses

| Endpoint | Auth | Description |
| --- | --- | --- |
| `GET /api/campuses` | JWT | `?search=&organizationId=&limit=&offset=`. Public campuses plus the private ones you belong to |
| `GET /api/campuses/mine` | JWT | Campuses you joined, newest first, with `myRole` |
| `GET /api/campuses/:campusId` | JWT + visible | `200` with `{ campus, organization, memberCount, myRole }`; `403` on a private campus you have not joined |
| `POST /api/campuses` | platform `admin` | Body `{ organizationId, name, slug?, city?, description?, isPublic? }` → `201`. The creator becomes campus `admin` |
| `PATCH /api/campuses/:campusId` | campus `admin` | Partial update of `name/slug/city/description/isPublic` |
| `POST /api/campuses/:campusId/join` | JWT, 10/min | `201` on join, `200` if already a member. Private campuses require your account email to end with one of the organization `emailDomains` → `403` |
| `DELETE /api/campuses/:campusId/membership` | JWT | Leave; `409` if you are the last campus admin |

### 4.3 Campus members

| Endpoint | Auth | Description |
| --- | --- | --- |
| `GET /api/campuses/:campusId/members` | campus `member` | `{ members, total, limit, offset }`. `email` is only present for `moderator` and above |
| `PATCH /api/campuses/:campusId/members/:userId` | campus `admin` | Body `{ role }`. `403` against a peer or superior, `409` if it would leave the campus admin-less |
| `DELETE /api/campuses/:campusId/members/:userId` | campus `moderator` | Same peer/superior and last-admin rules |

Unknown `campusId` and malformed UUID params answer `404`/`400`; validation failures
answer `400` with `{ error, fields }`.

---

## 5. Courses & past papers

Past papers (`documents`) belong to a `course`, and a course belongs to an
`organization` — the whole school, not one campus. Access is therefore the highest
rank the caller holds in **any** campus of that school (`getOrganizationRank`):
`member` to browse and upload, `moderator` to approve or delete anyone's file.

### 5.1 Courses

| Endpoint | Auth | Description |
| --- | --- | --- |
| `GET /api/courses` | JWT | `?organizationId=&search=&limit=&offset=`. Only courses of the schools you joined; `documentCount` included. Not a member anywhere → `200` with `[]`, foreign `organizationId` → `403` |
| `GET /api/courses/:courseId` | JWT | `{ course, organization }`; `404` unknown id, `403` when you joined no campus of that school |
| `POST /api/courses` | rank ≥ `member` | Body `{ organizationId, name, slug? }` → `201`. Slug defaults to the slugified name; duplicate inside the school → `409` |

### 5.2 Documents

| Endpoint | Auth | Description |
| --- | --- | --- |
| `GET /api/courses/:courseId/documents` | rank ≥ `member` | `?search=&period=&academicYear=&sort=recent\|downloads&limit=&offset=`. Below `moderator` you only see `approved` files plus your own |
| `POST /api/courses/:courseId/documents` | rank ≥ `member`, 5/min | `multipart/form-data`, see 5.3 → `201` with `status: "pending"` |
| `GET /api/documents/:documentId/download` | JWT, 30/min | `{ url, expiresIn, fileName, sizeBytes }` — a presigned bucket URL, the bytes never pass through the API. `403` if the file is not approved and is not yours |
| `PATCH /api/documents/:documentId/status` | rank ≥ `moderator` | Body `{ status: "pending" \| "approved" \| "rejected" }` → `200` with the document |
| `DELETE /api/documents/:documentId` | uploader or rank ≥ `moderator` | Removes the row, then the stored object on a best-effort basis |

### 5.3 Upload parts

| Part | Required | Notes |
| --- | --- | --- |
| `file` | yes | PDF, PNG or JPEG. The type comes from the file's magic bytes, not the declared MIME → `415` otherwise |
| `title` | no | Defaults to the sanitized file name, capped at 200 characters |
| `period` | no | `S1`…`S9` — anything else is a `400`, because it is a list filter |
| `academicYear` | no | `2025-2026` range form |
| `campusId` | no | UUID of the campus the paper comes from; any other value is dropped, never trusted |

Size cap is `MAX_UPLOAD_MB` (default 25) → `413`. Uploading the exact same bytes
twice into one course is a `409`; files that differ by one byte are separate rows.

---

## 6. Groups & events

Both are anchored on one campus — unlike past papers they never cross cities. Reading
them requires the campus to be visible to you; joining, creating and RSVP'ing require
campus membership (`rank >= member`). Group management is held by its `host` rows, by
campus `moderator` and above, and by platform admins.

### 6.1 Groups

| Endpoint | Auth | Description |
| --- | --- | --- |
| `GET /api/campuses/:campusId/groups` | visible | `?search=&topic=&sort=recent\|popular\|name&limit=&offset=` with `memberCount` and `myRole` |
| `POST /api/campuses/:campusId/groups` | `member`, 10/min | Body `{ name, slug?, description?, topic?, capacity? }` → `201`. The creator is inserted as `host`. Duplicate slug in the campus → `409` |
| `GET /api/groups/mine` | JWT | Every group you belong to, across campuses, each with its `campus` |
| `GET /api/groups/:groupId` | `member` | `{ group, members }` — the 20 first members, oldest first |
| `PATCH /api/groups/:groupId` | host / `moderator` | Partial update. Renaming rewrites the slug unless `slug` is sent |
| `DELETE /api/groups/:groupId` | host / `moderator` | `200`, cascades the membership rows |
| `POST /api/groups/:groupId/join` | `member`, 10/min | `201`, `200` if already in, `409` when `capacity` is reached |
| `DELETE /api/groups/:groupId/membership` | JWT | Leave. If the last host leaves, the longest-standing member is promoted |
| `GET /api/groups/:groupId/members` | `member` | `{ members, total }` — `userId`, `name`, `picture`, `role`, no emails |

### 6.2 Events

| Endpoint | Auth | Description |
| --- | --- | --- |
| `GET /api/campuses/:campusId/events` | visible | `?from=&to=&status=&includePast=&limit=&offset=`. Defaults to upcoming, `scheduled` only. Each row carries `goingCount`, `myRsvp`, `seatsLeft` |
| `POST /api/campuses/:campusId/events` | `member`, 10/min | Body `{ title, location, startsAt, endsAt?, description?, capacity?, groupId? }` → `201`. `startsAt` must be in the future, `endsAt` after it, and `groupId` must belong to the same campus |
| `GET /api/events/mine` | JWT | Events you organized or answered, with their `campus` |
| `GET /api/events/:eventId` | `member` | `{ event, attendees }` — the 50 first answers, oldest first |
| `PATCH /api/events/:eventId` | organizer / `moderator` | Partial update; `status: "cancelled"` is how an event is cancelled without losing its RSVPs |
| `DELETE /api/events/:eventId` | organizer / `moderator` | Removes the event and its answers |
| `POST /api/events/:eventId/rsvp` | `member` | Body `{ status: "going" \| "interested" }` → `200`, idempotent (it updates your answer). Only `going` takes a seat → `409` when full; `409` on a cancelled event |
| `DELETE /api/events/:eventId/rsvp` | JWT | Withdraw your answer |

`startsAt` and `endsAt` are `timestamptz`: send and read them as ISO strings with an
offset (`2026-10-05T18:30:00+02:00`), since students meet across timezones.

---

## 7. Data Models

### Content object (`contents` table)

| Field | Type | Description |
| --- | --- | --- |
| `id` | UUID | Primary key |
| `title` | string | Title of the post/video |
| `url` | string | Canonical link to the source platform (unique) |
| `source` | string | Platform origin — `Dev.to`, `YouTube`, `TechCrunch`, etc. |
| `type` | `article` `\|` `video` `\|` `social_post` | Media format |
| `summary` | string | Text snippet or description |
| `body` | string \| null | Full article body |
| `categories` | string[] | Auto-classified categories |
| `image` | string \| null | Thumbnail/cover URL |
| `embedCode` | string \| null | Safe iframe snippet for video embedding |
| `createdAt` | ISO timestamp | DB insertion time |

### User profile object (`users` table)

| Field | Type | Description |
| --- | --- | --- |
| `id` | UUID | Primary key |
| `email` | string | Unique email |
| `name` | string | Display name |
| `role` | `user` `\|` `admin` | Access level |
| `picture` | string \| null | Avatar URL (set on Google sign-in) |

> Registers/logins expose only `id`, `name`, `email`, `role`, `picture` — never the password hash.

### Campus object (`campuses` table)

| Field | Type | Description |
| --- | --- | --- |
| `id` | UUID | Primary key |
| `organizationId` | UUID | Owning school — FK to `organizations`, `ON DELETE RESTRICT` |
| `name` | string | Campus display name |
| `slug` | string | URL-safe unique identifier |
| `city` | string \| null | Display location |
| `description` | string \| null | Free text shown on the campus card |
| `isPublic` | boolean | Private campuses are hidden from search and gated by email domain |
| `organization` | object | `{ id, name, slug }` joined in every list response |
| `myRole` | `member` \| `moderator` \| `admin` \| null | Your membership, `null` when you are not a member |

### Organization object (`organizations` table)

| Field | Type | Description |
| --- | --- | --- |
| `id` | UUID | Primary key |
| `name` / `slug` | string | Display name, unique slug |
| `emailDomains` | string[] | School domains proving membership of a private campus. Not yet verified by sending email |

> Bootstrap note: nothing in the API can grant the platform `admin` role, so the first
> administrator has to be promoted directly in SQL:
> `UPDATE users SET role = 'admin' WHERE email = 'you@epitech.eu';`

### Course object (`courses` table)

| Field | Type | Description |
| --- | --- | --- |
| `id` | UUID | Primary key |
| `organizationId` | UUID | Owning school — FK to `organizations`, `ON DELETE RESTRICT` |
| `name` | string | Display name |
| `slug` | string | Unique **within the school** (`courses_organization_slug_unique_idx`) |
| `createdAt` | ISO timestamp | DB insertion time |

List responses add `organizationName` and `documentCount`; `GET /api/courses/:courseId`
returns the raw row next to its `organization`.

### Document object (`documents` table)

| Field | Type | Description |
| --- | --- | --- |
| `id` | UUID | Primary key |
| `courseId` | UUID | Parent course — `ON DELETE CASCADE` |
| `title` | string | Student-supplied label |
| `fileName` | string | Sanitized name from the upload |
| `mimeType` | string | `application/pdf` \| `image/png` \| `image/jpeg`, from the magic bytes |
| `sizeBytes` | integer | Buffer size |
| `period` | `S1`…`S9` \| null | Semester filter |
| `academicYear` | string \| null | `2025-2026` |
| `status` | `pending` \| `approved` \| `rejected` | Only `approved` is shared with other students |
| `downloads` | integer | Bumped when a presigned URL is handed out |
| `uploaderId` | UUID \| null | `ON DELETE SET NULL` — a paper outlives its author's account |
| `campusId` | UUID \| null | Provenance only, never used for access control |
| `isMine` | boolean | Derived: you uploaded it |
| `canModerate` | boolean | Derived: your school-wide rank is `moderator` or above |

> `storageKey` and `checksum` stay server-side. The bucket is private
> (`mc anonymous set none`), so the only way to read a file is the presigned URL from
> `GET /api/documents/:id/download`, valid `SIGNED_URL_TTL_SECONDS` (default 300).

### Group object (`groups` table)

| Field | Type | Description |
| --- | --- | --- |
| `id` | UUID | Primary key |
| `campusId` | UUID | Owning campus — `ON DELETE CASCADE` |
| `name` / `slug` | string | Slug unique **within the campus** |
| `description` | string \| null | Free text |
| `topic` | string \| null | `revision`, `projets`, `sport`… filtered with `?topic=` |
| `capacity` | integer \| null | `null` = unlimited; caps members, hosts included |
| `createdBy` | UUID \| null | `ON DELETE SET NULL` |
| `memberCount` | integer | Derived, added to every list response |
| `myRole` | `member` \| `host` \| null | Derived from `group_members` |

### Event object (`events` table)

| Field | Type | Description |
| --- | --- | --- |
| `id` | UUID | Primary key |
| `campusId` | UUID | Where it happens — `ON DELETE CASCADE` |
| `groupId` | UUID \| null | Optional host group, `ON DELETE SET NULL` |
| `title` / `description` | string | Announcement |
| `location` | string | Free text, required — a room, not a coordinate |
| `startsAt` / `endsAt` | ISO timestamp (`timestamptz`) | `endsAt` optional, always after `startsAt` |
| `capacity` | integer \| null | `null` = unlimited seats |
| `status` | `scheduled` \| `cancelled` | Hidden from the default list when cancelled |
| `createdBy` | UUID \| null | The organizer; `SET NULL` if the account goes away |
| `goingCount` / `myRsvp` / `seatsLeft` | derived | `seatsLeft` is `null` for uncapped events |
