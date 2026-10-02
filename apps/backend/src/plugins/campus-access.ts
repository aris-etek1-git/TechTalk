import { FastifyReply, FastifyRequest } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/db.js';
import { campusMembers, campuses } from '../db/schema.js';

export const CAMPUS_ROLES = ['member', 'moderator', 'admin'] as const;
export type CampusRole = (typeof CAMPUS_ROLES)[number];

const ROLE_RANK: Record<CampusRole, number> = { member: 1, moderator: 2, admin: 3 };
export { ROLE_RANK as CAMPUS_ROLE_RANK };

export type CampusRecord = (typeof campuses)['$inferSelect'];
export type MembershipRecord = (typeof campusMembers)['$inferSelect'];

export interface CampusAccess {
  campus: CampusRecord;
  membership: MembershipRecord | null;
  rank: number;
  isPlatformAdmin: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    campusAccess?: CampusAccess;
  }
}

type UserPayload = { id: string; email?: string; role?: string };

function currentUser(request: FastifyRequest): UserPayload | null {
  const user = request.user as UserPayload | undefined;
  return user?.id ? user : null;
}

export function isPlatformAdmin(request: FastifyRequest): boolean {
  return currentUser(request)?.role === 'admin';
}

/**
 * Resolves a campus and the caller's standing in it. Returns null when the
 * campus does not exist. A platform admin gets rank 3 without a membership row,
 * so they can moderate without polluting member lists.
 *
 * `loadCampusAccess` reads the id from the route params; group and event routes
 * have to resolve it from the row they just loaded, hence the explicit variant.
 */
export async function loadAccessForCampus(
  request: FastifyRequest,
  campusId: string
): Promise<CampusAccess | null> {
  if (request.campusAccess?.campus.id === campusId) return request.campusAccess;

  const user = currentUser(request);
  if (!campusId || !user) return null;

  const [campus] = await db.select().from(campuses).where(eq(campuses.id, campusId)).limit(1);
  if (!campus) return null;

  const [membership] = await db
    .select()
    .from(campusMembers)
    .where(and(eq(campusMembers.campusId, campus.id), eq(campusMembers.userId, user.id)))
    .limit(1);

  const platformAdmin = isPlatformAdmin(request);
  const access: CampusAccess = {
    campus,
    membership: membership ?? null,
    rank: platformAdmin ? ROLE_RANK.admin : membership ? ROLE_RANK[membership.role as CampusRole] ?? 0 : 0,
    isPlatformAdmin: platformAdmin,
  };
  request.campusAccess = access;
  return access;
}

export async function loadCampusAccess(request: FastifyRequest): Promise<CampusAccess | null> {
  const { campusId } = request.params as { campusId?: string };
  if (!campusId) return null;
  return loadAccessForCampus(request, campusId);
}

export function requireCampusRole(minRole: CampusRole) {
  const required = ROLE_RANK[minRole];
  return async function preHandlerCampusRole(request: FastifyRequest, reply: FastifyReply) {
    try {
      const access = await loadCampusAccess(request);
      if (!access) {
        return reply.status(404).send({ error: 'Not found', message: 'Campus not found.' });
      }
      if (access.rank < required) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: `This action requires the '${minRole}' role in this campus.`,
        });
      }
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Internal server error while checking campus access.' });
    }
  };
}

/** Read gate: a private campus is only visible to its members and to platform admins. */
export async function requireCampusVisible(request: FastifyRequest, reply: FastifyReply) {
  try {
    const access = await loadCampusAccess(request);
    if (!access) {
      return reply.status(404).send({ error: 'Not found', message: 'Campus not found.' });
    }
    if (!access.campus.isPublic && access.rank < ROLE_RANK.member) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'This campus is private. Join it to see its content.',
      });
    }
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while checking campus access.' });
  }
}

export function hasCampusRole(access: CampusAccess | null | undefined, minRole: CampusRole): boolean {
  return (access?.rank ?? 0) >= ROLE_RANK[minRole];
}

/**
 * Highest campus role the caller holds inside an organization. School-wide
 * resources (the course catalog, past papers) are gated this way instead of by
 * a single campus, so a Lyon student can read what Brussels shared.
 */
export async function getOrganizationRank(request: FastifyRequest, organizationId: string): Promise<number> {
  if (isPlatformAdmin(request)) return ROLE_RANK.admin;

  const user = currentUser(request);
  if (!user) return 0;

  const rows = await db
    .select({ role: campusMembers.role })
    .from(campusMembers)
    .innerJoin(campuses, eq(campusMembers.campusId, campuses.id))
    .where(and(eq(campuses.organizationId, organizationId), eq(campusMembers.userId, user.id)));

  return rows.reduce((best, row) => Math.max(best, ROLE_RANK[row.role as CampusRole] ?? 0), 0);
}
