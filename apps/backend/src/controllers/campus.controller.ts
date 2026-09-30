import { FastifyReply, FastifyRequest } from 'fastify';
import { and, asc, count, desc, eq, ilike, inArray, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/db.js';
import { campusMembers, campuses, organizations, users } from '../db/schema.js';
import { CAMPUS_ROLES, CAMPUS_ROLE_RANK, hasCampusRole, loadCampusAccess, type CampusAccess } from '../plugins/campus-access.js';
import { isValidSlug, slugify } from '../utils/slug.js';

const uuidParam = z.object({ campusId: z.string().uuid() });

const campusSlug = z
  .string()
  .trim()
  .min(2)
  .max(140)
  .transform((value) => slugify(value))
  .refine(isValidSlug, { message: 'Slug may only contain lowercase letters, digits and single hyphens.' });

const createCampusSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  slug: campusSlug.optional(),
  city: z.string().trim().max(100).nullish(),
  description: z.string().trim().max(500).nullish(),
  isPublic: z.boolean().optional().default(true),
});

const updateCampusSchema = createCampusSchema.omit({ organizationId: true }).partial();

const listQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  organizationId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
});

const memberRoleSchema = z.object({ role: z.enum(CAMPUS_ROLES) });

function validationError(reply: FastifyReply, error: z.ZodError) {
  return reply.status(400).send({
    error: 'Validation failed',
    fields: error.flatten().fieldErrors,
  });
}

function badUuid(reply: FastifyReply) {
  return reply.status(400).send({ error: 'Invalid campus id.' });
}

/** Admins are not overruled by moderators; a platform admin outranks everyone. */
function canManage(access: CampusAccess, targetRole: string): boolean {
  if (access.isPlatformAdmin) return true;
  return (CAMPUS_ROLE_RANK[targetRole as (typeof CAMPUS_ROLES)[number]] ?? 0) < access.rank;
}

/** A campus without at least one campus admin would become unmanageable. */
async function isLastCampusAdmin(campusId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ admins: count() })
    .from(campusMembers)
    .where(and(eq(campusMembers.campusId, campusId), eq(campusMembers.role, 'admin')));
  if (!row || row.admins > 1) return false;
  const [target] = await db
    .select({ role: campusMembers.role })
    .from(campusMembers)
    .where(and(eq(campusMembers.campusId, campusId), eq(campusMembers.userId, userId)))
    .limit(1);
  return target?.role === 'admin';
}

async function resolveCampusWithOrganization(campusId: string) {
  const [row] = await db
    .select({
      campus: campuses,
      organization: organizations,
    })
    .from(campuses)
    .innerJoin(organizations, eq(campuses.organizationId, organizations.id))
    .where(eq(campuses.id, campusId))
    .limit(1);
  return row ?? null;
}

export async function handleListCampuses(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) return validationError(reply, parsed.error);
    const userId = (request.user as { id: string }).id;
    const { search, organizationId, limit, offset } = parsed.data;

    const myMemberships = await db
      .select({ campusId: campusMembers.campusId })
      .from(campusMembers)
      .where(eq(campusMembers.userId, userId));
    const memberCampusIds = myMemberships.map((m) => m.campusId);

    // Private campuses never appear in search results for non-members.
    const visibility = memberCampusIds.length > 0
      ? or(eq(campuses.isPublic, true), inArray(campuses.id, memberCampusIds))
      : eq(campuses.isPublic, true);

    const conditions = [visibility];
    if (organizationId) conditions.push(eq(campuses.organizationId, organizationId));
    if (search) {
      conditions.push(or(
        ilike(campuses.name, `%${search}%`),
        ilike(campuses.city, `%${search}%`),
        ilike(organizations.name, `%${search}%`),
      )!);
    }

    const rows = await db
      .select({
        campus: campuses,
        organization: { id: organizations.id, name: organizations.name, slug: organizations.slug },
        membershipRole: campusMembers.role,
        joinedAt: campusMembers.joinedAt,
      })
      .from(campuses)
      .innerJoin(organizations, eq(campuses.organizationId, organizations.id))
      .leftJoin(campusMembers, and(eq(campusMembers.campusId, campuses.id), eq(campusMembers.userId, userId)))
      .where(and(...conditions))
      .orderBy(asc(organizations.name), asc(campuses.name))
      .limit(limit)
      .offset(offset);

    return reply.status(200).send({
      campuses: rows.map((row) => ({ ...row.campus, organization: row.organization, myRole: row.membershipRole ?? null })),
      limit,
      offset,
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while fetching campuses.' });
  }
}

export async function handleGetMyCampuses(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request.user as { id: string }).id;
    const rows = await db
      .select({
        campus: campuses,
        organization: { id: organizations.id, name: organizations.name, slug: organizations.slug },
        role: campusMembers.role,
        joinedAt: campusMembers.joinedAt,
      })
      .from(campusMembers)
      .innerJoin(campuses, eq(campusMembers.campusId, campuses.id))
      .innerJoin(organizations, eq(campuses.organizationId, organizations.id))
      .where(eq(campusMembers.userId, userId))
      .orderBy(desc(campusMembers.joinedAt));

    return reply.status(200).send({
      campuses: rows.map((row) => ({ ...row.campus, organization: row.organization, myRole: row.role })),
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while fetching your campuses.' });
  }
}

export async function handleGetCampus(request: FastifyRequest, reply: FastifyReply) {
  try {
    const access = request.campusAccess ?? (await loadCampusAccess(request));
    if (!access) return badUuid(reply);

    const [aggregate] = await db
      .select({ memberCount: count() })
      .from(campusMembers)
      .where(eq(campusMembers.campusId, access.campus.id));

    const org = await db
      .select({ id: organizations.id, name: organizations.name, slug: organizations.slug, emailDomains: organizations.emailDomains })
      .from(organizations)
      .where(eq(organizations.id, access.campus.organizationId))
      .limit(1);

    return reply.status(200).send({
      campus: access.campus,
      organization: org[0] ?? null,
      memberCount: aggregate?.memberCount ?? 0,
      myRole: access.membership?.role ?? null,
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while fetching the campus.' });
  }
}

export async function handleCreateCampus(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsed = createCampusSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    const userId = (request.user as { id: string }).id;
    const [organization] = await db.select().from(organizations).where(eq(organizations.id, parsed.data.organizationId)).limit(1);
    if (!organization) {
      return reply.status(400).send({ error: 'Unknown organizationId.' });
    }

    const slug = parsed.data.slug ?? slugify(parsed.data.name);
    if (!isValidSlug(slug)) {
      return reply.status(400).send({ error: 'Campus name produced an invalid slug.' });
    }

    const [created] = await db.insert(campuses).values({
      organizationId: organization.id,
      name: parsed.data.name,
      slug,
      city: parsed.data.city ?? null,
      description: parsed.data.description ?? null,
      isPublic: parsed.data.isPublic,
    }).returning();

    // The creator gets admin on the campus so it is never left unmanaged.
    await db.insert(campusMembers).values({ campusId: created.id, userId, role: 'admin' }).onConflictDoNothing();

    return reply.status(201).send({ message: 'Campus created successfully!', campus: created });
  } catch (error) {
    request.log.error(error);
    if ((error as { code?: string }).code === '23505') {
      return reply.status(409).send({ error: 'A campus with this slug already exists.' });
    }
    return reply.status(500).send({ error: 'Internal server error while creating the campus.' });
  }
}

export async function handleUpdateCampus(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsedParams = uuidParam.safeParse(request.params);
    if (!parsedParams.success) return badUuid(reply);

    const parsed = updateCampusSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    const { campusId } = parsedParams.data;
    const payload = parsed.data;
    if (Object.keys(payload).length === 0) {
      return reply.status(400).send({ error: 'Provide at least one field to update.' });
    }

    const [updated] = await db
      .update(campuses)
      .set({
        ...(payload.name !== undefined && { name: payload.name }),
        ...(payload.slug !== undefined && { slug: payload.slug }),
        ...(payload.city !== undefined && { city: payload.city ?? null }),
        ...(payload.description !== undefined && { description: payload.description ?? null }),
        ...(payload.isPublic !== undefined && { isPublic: payload.isPublic }),
      })
      .where(eq(campuses.id, campusId))
      .returning();

    if (!updated) return reply.status(404).send({ error: 'Campus not found.' });
    return reply.status(200).send({ message: 'Campus updated successfully!', campus: updated });
  } catch (error) {
    request.log.error(error);
    if ((error as { code?: string }).code === '23505') {
      return reply.status(409).send({ error: 'Another campus already uses this slug.' });
    }
    return reply.status(500).send({ error: 'Internal server error while updating the campus.' });
  }
}

/**
 * Joining is the entry point for private campuses, so it deliberately skips the
 * visibility gate: the proof of belonging is the email domain, not discovery.
 */
export async function handleJoinCampus(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsedParams = uuidParam.safeParse(request.params);
    if (!parsedParams.success) return badUuid(reply);

    const userId = (request.user as { id: string }).id;
    const resolved = await resolveCampusWithOrganization(parsedParams.data.campusId);
    if (!resolved) return reply.status(404).send({ error: 'Campus not found.' });

    if (!resolved.campus.isPublic) {
      const [account] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
      const domain = account?.email.split('@')[1]?.toLowerCase();
      const allowed = (resolved.organization.emailDomains ?? []).map((d) => d.toLowerCase());
      if (!domain || !allowed.includes(domain)) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: `This campus is private. Verify an address ending with @${allowed.join(' or @') || 'an approved domain'}.`,
        });
      }
    }

    const [membership] = await db
      .insert(campusMembers)
      .values({ campusId: resolved.campus.id, userId, role: 'member' })
      .onConflictDoNothing()
      .returning();

    if (!membership) {
      return reply.status(200).send({ message: 'You are already a member of this campus.' });
    }
    return reply.status(201).send({ message: 'You joined the campus!', membership });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while joining the campus.' });
  }
}

export async function handleLeaveCampus(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsedParams = uuidParam.safeParse(request.params);
    if (!parsedParams.success) return badUuid(reply);

    const access = await loadCampusAccess(request);
    if (!access || !access.membership) {
      return reply.status(404).send({ error: 'You are not a member of this campus.' });
    }
    if (await isLastCampusAdmin(access.campus.id, access.membership.userId)) {
      return reply.status(409).send({ error: 'Promote another member to admin before leaving this campus.' });
    }

    await db
      .delete(campusMembers)
      .where(and(eq(campusMembers.campusId, access.campus.id), eq(campusMembers.userId, access.membership.userId)));

    return reply.status(200).send({ message: 'You left the campus.' });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while leaving the campus.' });
  }
}

export async function handleListMembers(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsedParams = uuidParam.safeParse(request.params);
    if (!parsedParams.success) return badUuid(reply);

    const parsed = listQuerySchema.pick({ limit: true, offset: true }).safeParse(request.query);
    if (!parsed.success) return validationError(reply, parsed.error);

    const access = request.campusAccess ?? (await loadCampusAccess(request));
    if (!access) return badUuid(reply);
    const { campusId } = parsedParams.data;
    const { limit, offset } = parsed.data;

    const rows = await db
      .select({
        userId: campusMembers.userId,
        role: campusMembers.role,
        joinedAt: campusMembers.joinedAt,
        name: users.name,
        picture: users.picture,
        email: users.email,
      })
      .from(campusMembers)
      .innerJoin(users, eq(campusMembers.userId, users.id))
      .where(eq(campusMembers.campusId, campusId))
      .orderBy(asc(campusMembers.joinedAt))
      .limit(limit)
      .offset(offset);

    // Emails are a privacy leak toward the whole campus; moderators only.
    const canSeeEmails = hasCampusRole(access, 'moderator');
    const [total] = await db
      .select({ total: count() })
      .from(campusMembers)
      .where(eq(campusMembers.campusId, campusId));

    return reply.status(200).send({
      members: rows.map((row) => ({
        userId: row.userId,
        name: row.name,
        picture: row.picture,
        role: row.role,
        joinedAt: row.joinedAt,
        ...(canSeeEmails && { email: row.email }),
      })),
      total: total?.total ?? 0,
      limit,
      offset,
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while fetching campus members.' });
  }
}

export async function handleChangeMemberRole(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsedParams = uuidParam.extend({ userId: z.string().uuid() }).safeParse(request.params);
    if (!parsedParams.success) return badUuid(reply);

    const parsed = memberRoleSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    const access = request.campusAccess ?? (await loadCampusAccess(request));
    if (!access) return badUuid(reply);

    const { campusId, userId: targetUserId } = parsedParams.data;
    const [target] = await db
      .select()
      .from(campusMembers)
      .where(and(eq(campusMembers.campusId, campusId), eq(campusMembers.userId, targetUserId)))
      .limit(1);

    if (!target) return reply.status(404).send({ error: 'That user is not a member of this campus.' });

    if (!canManage(access, target.role)) {
      return reply.status(403).send({ error: 'You cannot change the role of a peer or a superior.' });
    }

    if (target.role === 'admin' && parsed.data.role !== 'admin' && await isLastCampusAdmin(campusId, targetUserId)) {
      return reply.status(409).send({ error: 'The campus must keep at least one admin.' });
    }

    const [updated] = await db
      .update(campusMembers)
      .set({ role: parsed.data.role })
      .where(and(eq(campusMembers.campusId, campusId), eq(campusMembers.userId, targetUserId)))
      .returning();

    return reply.status(200).send({ message: 'Member role updated.', membership: updated });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while updating the member role.' });
  }
}

export async function handleRemoveMember(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsedParams = uuidParam.extend({ userId: z.string().uuid() }).safeParse(request.params);
    if (!parsedParams.success) return badUuid(reply);

    const access = request.campusAccess ?? (await loadCampusAccess(request));
    if (!access) return badUuid(reply);

    const { campusId, userId: targetUserId } = parsedParams.data;
    const [target] = await db
      .select()
      .from(campusMembers)
      .where(and(eq(campusMembers.campusId, campusId), eq(campusMembers.userId, targetUserId)))
      .limit(1);

    if (!target) return reply.status(404).send({ error: 'That user is not a member of this campus.' });
    if (!canManage(access, target.role)) {
      return reply.status(403).send({ error: 'You cannot remove a peer or a superior.' });
    }
    if (target.role === 'admin' && await isLastCampusAdmin(campusId, targetUserId)) {
      return reply.status(409).send({ error: 'The campus must keep at least one admin.' });
    }

    await db
      .delete(campusMembers)
      .where(and(eq(campusMembers.campusId, campusId), eq(campusMembers.userId, targetUserId)));

    return reply.status(200).send({ message: 'Member removed from the campus.' });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while removing the member.' });
  }
}

const createOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: campusSlug.optional(),
  emailDomains: z.array(z.string().trim().toLowerCase().min(4).max(255)).max(20).optional().default([]),
});

export async function handleListOrganizations(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsed = z.object({ search: z.string().trim().max(120).optional() }).safeParse(request.query);
    if (!parsed.success) return validationError(reply, parsed.error);

    const rows = await db
      .select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
      .from(organizations)
      .where(parsed.data.search ? ilike(organizations.name, `%${parsed.data.search}%`) : undefined)
      .orderBy(asc(organizations.name))
      .limit(100);

    return reply.status(200).send({ organizations: rows });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while fetching organizations.' });
  }
}

export async function handleCreateOrganization(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsed = createOrganizationSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    const slug = parsed.data.slug ?? slugify(parsed.data.name);
    if (!isValidSlug(slug)) {
      return reply.status(400).send({ error: 'Organization name produced an invalid slug.' });
    }

    const [created] = await db.insert(organizations).values({
      name: parsed.data.name,
      slug,
      emailDomains: parsed.data.emailDomains,
    }).returning({ id: organizations.id, name: organizations.name, slug: organizations.slug });

    return reply.status(201).send({ message: 'Organization created successfully!', organization: created });
  } catch (error) {
    request.log.error(error);
    if ((error as { code?: string }).code === '23505') {
      return reply.status(409).send({ error: 'An organization with this slug already exists.' });
    }
    return reply.status(500).send({ error: 'Internal server error while creating the organization.' });
  }
}
