import { FastifyReply, FastifyRequest } from 'fastify';
import { and, asc, count, desc, eq, ilike, inArray, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/db.js';
import { campuses, groupMembers, groups, users } from '../db/schema.js';
import {
  CAMPUS_ROLE_RANK,
  loadAccessForCampus,
  loadCampusAccess,
  type CampusAccess,
} from '../plugins/campus-access.js';
import { isValidSlug, slugify } from '../utils/slug.js';

const uuidParam = z.object({ campusId: z.string().uuid() });
const groupIdParam = z.object({ groupId: z.string().uuid() });

const createGroupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(140)
    .transform((value) => slugify(value))
    .refine((value) => isValidSlug(value), { message: 'Slug may only contain lowercase letters, digits and single hyphens.' })
    .optional(),
  description: z.string().trim().max(2000).optional(),
  topic: z.string().trim().max(60).optional(),
  capacity: z.coerce.number().int().min(2).max(1000).nullable().optional(),
});

const updateGroupSchema = createGroupSchema.partial();

const listQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  topic: z.string().trim().max(60).optional(),
  sort: z.enum(['recent', 'popular', 'name']).default('recent'),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
});

function validationError(reply: FastifyReply, error: z.ZodError) {
  return reply.status(400).send({ error: 'Validation failed', fields: error.flatten().fieldErrors });
}

function badUuid(reply: FastifyReply) {
  return reply.status(400).send({ error: 'Invalid identifier.' });
}

function currentUserId(request: FastifyRequest): string {
  return (request.user as { id: string }).id;
}

/** Resolves a group together with the caller's standing in its campus. */
async function resolveGroup(request: FastifyRequest, groupId: string) {
  const [group] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!group) return null;
  const access = await loadAccessForCampus(request, group.campusId);
  if (!access) return null;
  return { group, access };
}

/** Group management is open to its hosts, to campus moderators and to platform admins. */
function canManageGroup(group: typeof groups.$inferSelect, access: CampusAccess, isHost: boolean, userId: string) {
  return (
    access.isPlatformAdmin ||
    access.rank >= CAMPUS_ROLE_RANK.moderator ||
    isHost ||
    group.createdBy === userId
  );
}

async function membershipCounts(groupIds: string[]): Promise<Map<string, number>> {
  if (groupIds.length === 0) return new Map();
  const rows = await db
    .select({ groupId: groupMembers.groupId, memberCount: count() })
    .from(groupMembers)
    .where(inArray(groupMembers.groupId, groupIds))
    .groupBy(groupMembers.groupId);
  return new Map(rows.map((row) => [row.groupId, row.memberCount]));
}

async function myRoles(groupIds: string[], userId: string): Promise<Map<string, string>> {
  if (groupIds.length === 0) return new Map();
  const rows = await db
    .select({ groupId: groupMembers.groupId, role: groupMembers.role })
    .from(groupMembers)
    .where(and(inArray(groupMembers.groupId, groupIds), eq(groupMembers.userId, userId)));
  return new Map(rows.map((row) => [row.groupId, row.role]));
}

function shapeGroup(
  group: typeof groups.$inferSelect,
  counts: Map<string, number>,
  roles: Map<string, string>,
  campus?: Record<string, unknown>
) {
  return {
    ...group,
    memberCount: counts.get(group.id) ?? 0,
    myRole: roles.get(group.id) ?? null,
    ...(campus && { campus }),
  };
}

export async function handleListCampusGroups(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsedParams = uuidParam.safeParse(request.params);
    if (!parsedParams.success) return badUuid(reply);

    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) return validationError(reply, parsed.error);

    const access = request.campusAccess ?? (await loadCampusAccess(request));
    if (!access) return reply.status(404).send({ error: 'Campus not found.' });

    const { search, topic, sort, limit, offset } = parsed.data;
    const conditions = [eq(groups.campusId, access.campus.id)];
    if (search) conditions.push(or(ilike(groups.name, `%${search}%`), ilike(groups.slug, `%${search}%`))!);
    if (topic) conditions.push(ilike(groups.topic, `%${topic}%`));

    const rows = await db
      .select({ group: groups })
      .from(groups)
      .where(and(...conditions))
      .orderBy(sort === 'name' ? asc(groups.name) : desc(groups.createdAt))
      .limit(limit)
      .offset(offset);

    const ids = rows.map((row) => row.group.id);
    const userId = currentUserId(request);
    const counts = await membershipCounts(ids);
    const roles = await myRoles(ids, userId);

    const shaped = rows.map((row) => shapeGroup(row.group, counts, roles));
    // 'popular' is ranked by a count that only exists after the page is fetched,
    // so it reorders this page rather than the whole table.
    if (sort === 'popular') shaped.sort((a, b) => b.memberCount - a.memberCount);

    return reply.status(200).send({ groups: shaped, limit, offset });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while fetching groups.' });
  }
}

/** Every group the caller belongs to, across all of their campuses. */
export async function handleListMyGroups(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = currentUserId(request);
    const memberships = await db
      .select({ groupId: groupMembers.groupId })
      .from(groupMembers)
      .where(eq(groupMembers.userId, userId));

    const ids = memberships.map((row) => row.groupId);
    if (ids.length === 0) return reply.status(200).send({ groups: [] });

    const rows = await db
      .select({
        group: groups,
        campus: { id: campuses.id, name: campuses.name, slug: campuses.slug, city: campuses.city },
      })
      .from(groups)
      .innerJoin(campuses, eq(groups.campusId, campuses.id))
      .where(inArray(groups.id, ids))
      .orderBy(desc(groups.createdAt));

    const counts = await membershipCounts(ids);
    const roles = await myRoles(ids, userId);

    return reply.status(200).send({ groups: rows.map((row) => shapeGroup(row.group, counts, roles, row.campus)) });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while fetching your groups.' });
  }
}

export async function handleGetGroup(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsedParams = groupIdParam.safeParse(request.params);
    if (!parsedParams.success) return badUuid(reply);

    const resolved = await resolveGroup(request, parsedParams.data.groupId);
    if (!resolved) return reply.status(404).send({ error: 'Group not found.' });
    if (resolved.access.rank < CAMPUS_ROLE_RANK.member) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Join the campus first.' });
    }

    const counts = await membershipCounts([resolved.group.id]);
    const roles = await myRoles([resolved.group.id], currentUserId(request));
    const members = await listMembers(resolved.group.id);

    return reply.status(200).send({ group: shapeGroup(resolved.group, counts, roles), members });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while fetching the group.' });
  }
}

async function listMembers(groupId: string, limit?: number) {
  const query = db
    .select({
      userId: groupMembers.userId,
      role: groupMembers.role,
      joinedAt: groupMembers.joinedAt,
      name: users.name,
      picture: users.picture,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(eq(groupMembers.groupId, groupId))
    .orderBy(asc(groupMembers.joinedAt));

  return limit ? query.limit(limit) : query;
}

export async function handleCreateGroup(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsedParams = uuidParam.safeParse(request.params);
    if (!parsedParams.success) return badUuid(reply);

    const parsed = createGroupSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    const access = request.campusAccess ?? (await loadCampusAccess(request));
    if (!access) return reply.status(404).send({ error: 'Campus not found.' });

    const userId = currentUserId(request);
    const slug = parsed.data.slug ?? slugify(parsed.data.name);
    if (!isValidSlug(slug)) {
      return reply.status(400).send({ error: 'Group name produced an invalid slug.' });
    }

    const [created] = await db
      .insert(groups)
      .values({
        campusId: access.campus.id,
        name: parsed.data.name,
        slug,
        description: parsed.data.description ?? null,
        topic: parsed.data.topic ?? null,
        capacity: parsed.data.capacity ?? null,
        createdBy: userId,
      })
      .returning();

    // The creator hosts the group: without this row nobody could manage it later.
    await db.insert(groupMembers).values({ groupId: created.id, userId, role: 'host' });

    return reply.status(201).send({ message: 'Group created successfully!', group: created });
  } catch (error) {
    request.log.error(error);
    if ((error as { code?: string }).code === '23505') {
      return reply.status(409).send({ error: 'This campus already has a group with this slug.' });
    }
    return reply.status(500).send({ error: 'Internal server error while creating the group.' });
  }
}

export async function handleUpdateGroup(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsedParams = groupIdParam.safeParse(request.params);
    if (!parsedParams.success) return badUuid(reply);

    const parsed = updateGroupSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    const resolved = await resolveGroup(request, parsedParams.data.groupId);
    if (!resolved) return reply.status(404).send({ error: 'Group not found.' });

    const userId = currentUserId(request);
    if (!canManageGroup(resolved.group, resolved.access, await isHost(resolved.group.id, userId), userId)) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Hosts and campus moderators only.' });
    }

    const set: Partial<typeof groups.$inferInsert> = {};
    if (parsed.data.name !== undefined) set.name = parsed.data.name;
    // Renaming rewrites the slug unless the caller pinned one explicitly.
    if (parsed.data.slug !== undefined) set.slug = parsed.data.slug;
    else if (parsed.data.name !== undefined) set.slug = slugify(parsed.data.name);
    if (parsed.data.description !== undefined) set.description = parsed.data.description;
    if (parsed.data.topic !== undefined) set.topic = parsed.data.topic;
    if (parsed.data.capacity !== undefined) set.capacity = parsed.data.capacity ?? null;

    if (set.slug && !isValidSlug(set.slug)) return reply.status(400).send({ error: 'Invalid slug.' });
    if (Object.keys(set).length === 0) return reply.status(400).send({ error: 'Nothing to update.' });

    const [updated] = await db.update(groups).set(set).where(eq(groups.id, resolved.group.id)).returning();

    return reply.status(200).send({ message: 'Group updated.', group: updated });
  } catch (error) {
    request.log.error(error);
    if ((error as { code?: string }).code === '23505') {
      return reply.status(409).send({ error: 'This campus already has a group with this slug.' });
    }
    return reply.status(500).send({ error: 'Internal server error while updating the group.' });
  }
}

async function isHost(groupId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId), eq(groupMembers.role, 'host')))
    .limit(1);
  return Boolean(row);
}

export async function handleJoinGroup(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsedParams = groupIdParam.safeParse(request.params);
    if (!parsedParams.success) return badUuid(reply);

    const resolved = await resolveGroup(request, parsedParams.data.groupId);
    if (!resolved) return reply.status(404).send({ error: 'Group not found.' });
    if (resolved.access.rank < CAMPUS_ROLE_RANK.member) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Join the campus first.' });
    }

    const userId = currentUserId(request);
    if (resolved.group.capacity !== null) {
      const [tally] = await db
        .select({ memberCount: count() })
        .from(groupMembers)
        .where(eq(groupMembers.groupId, resolved.group.id));
      if ((tally?.memberCount ?? 0) >= resolved.group.capacity) {
        return reply.status(409).send({ error: 'This group is full.' });
      }
    }

    const [membership] = await db
      .insert(groupMembers)
      .values({ groupId: resolved.group.id, userId, role: 'member' })
      .onConflictDoNothing()
      .returning();

    if (!membership) {
      return reply.status(200).send({ message: 'You are already in this group.' });
    }
    return reply.status(201).send({ message: 'You joined the group!', membership });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while joining the group.' });
  }
}

export async function handleLeaveGroup(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsedParams = groupIdParam.safeParse(request.params);
    if (!parsedParams.success) return badUuid(reply);

    const resolved = await resolveGroup(request, parsedParams.data.groupId);
    if (!resolved) return reply.status(404).send({ error: 'Group not found.' });

    const userId = currentUserId(request);
    const [membership] = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, resolved.group.id), eq(groupMembers.userId, userId)))
      .limit(1);

    if (!membership) return reply.status(404).send({ error: 'You are not in this group.' });

    await db
      .delete(groupMembers)
      .where(and(eq(groupMembers.groupId, resolved.group.id), eq(groupMembers.userId, userId)));

    // A group without a host is unmanageable, so the longest-standing member takes
    // over instead of blocking the departure the way the campus rules do.
    if (membership.role === 'host') {
      const [remainingHost] = await db
        .select()
        .from(groupMembers)
        .where(and(eq(groupMembers.groupId, resolved.group.id), eq(groupMembers.role, 'host')))
        .limit(1);

      if (!remainingHost) {
        const [successor] = await db
          .select()
          .from(groupMembers)
          .where(eq(groupMembers.groupId, resolved.group.id))
          .orderBy(asc(groupMembers.joinedAt))
          .limit(1);

        if (successor) {
          await db.update(groupMembers).set({ role: 'host' }).where(eq(groupMembers.id, successor.id));
        }
      }
    }

    return reply.status(200).send({ message: 'You left the group.' });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while leaving the group.' });
  }
}

export async function handleListGroupMembers(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsedParams = groupIdParam.safeParse(request.params);
    if (!parsedParams.success) return badUuid(reply);

    const resolved = await resolveGroup(request, parsedParams.data.groupId);
    if (!resolved) return reply.status(404).send({ error: 'Group not found.' });
    if (resolved.access.rank < CAMPUS_ROLE_RANK.member) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Join the campus first.' });
    }

    const members = await listMembers(resolved.group.id);
    return reply.status(200).send({ members, total: members.length });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while fetching group members.' });
  }
}

export async function handleDeleteGroup(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsedParams = groupIdParam.safeParse(request.params);
    if (!parsedParams.success) return badUuid(reply);

    const resolved = await resolveGroup(request, parsedParams.data.groupId);
    if (!resolved) return reply.status(404).send({ error: 'Group not found.' });

    const userId = currentUserId(request);
    if (!canManageGroup(resolved.group, resolved.access, await isHost(resolved.group.id, userId), userId)) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Hosts and campus moderators only.' });
    }

    await db.delete(groups).where(eq(groups.id, resolved.group.id));
    return reply.status(200).send({ message: 'Group removed.' });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while deleting the group.' });
  }
}
