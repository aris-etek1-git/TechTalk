import { FastifyReply, FastifyRequest } from 'fastify';
import { and, asc, count, desc, eq, ilike, inArray, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/db.js';
import { campusMembers, campuses, courses, documents, organizations } from '../db/schema.js';
import { getOrganizationRank } from '../plugins/campus-access.js';
import { isValidSlug, slugify } from '../utils/slug.js';

const courseSlug = z
  .string()
  .trim()
  .min(2)
  .max(160)
  .transform((value) => slugify(value))
  .refine((value) => isValidSlug(value), { message: 'Slug may only contain lowercase letters, digits and single hyphens.' });

const createCourseSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(2).max(160),
  slug: courseSlug.optional(),
});

const listQuerySchema = z.object({
  organizationId: z.string().uuid().optional(),
  search: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

function validationError(reply: FastifyReply, error: z.ZodError) {
  return reply.status(400).send({ error: 'Validation failed', fields: error.flatten().fieldErrors });
}

/** Organizations the caller can see courses for: the ones they joined. */
async function memberOrganizationIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ organizationId: campuses.organizationId })
    .from(campusMembers)
    .innerJoin(campuses, eq(campusMembers.campusId, campuses.id))
    .where(eq(campusMembers.userId, userId));
  return Array.from(new Set(rows.map((row) => row.organizationId)));
}

export async function handleListCourses(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) return validationError(reply, parsed.error);

    const userId = (request.user as { id: string }).id;
    const allowedOrgs = await memberOrganizationIds(userId);
    if (allowedOrgs.length === 0) {
      return reply.status(200).send({ courses: [], limit: parsed.data.limit, offset: parsed.data.offset });
    }

    const conditions = [inArray(courses.organizationId, allowedOrgs)];
    if (parsed.data.organizationId) {
      if (!allowedOrgs.includes(parsed.data.organizationId)) {
        return reply.status(403).send({ error: 'Forbidden', message: 'You are not a member of this organization.' });
      }
      conditions.push(eq(courses.organizationId, parsed.data.organizationId));
    }
    if (parsed.data.search) {
      conditions.push(or(
        ilike(courses.name, `%${parsed.data.search}%`),
        ilike(courses.slug, `%${parsed.data.search}%`),
      )!);
    }

    const rows = await db
      .select({
        id: courses.id,
        organizationId: courses.organizationId,
        name: courses.name,
        slug: courses.slug,
        organizationName: organizations.name,
        documentCount: count(documents.id),
      })
      .from(courses)
      .innerJoin(organizations, eq(courses.organizationId, organizations.id))
      .leftJoin(documents, and(eq(documents.courseId, courses.id)))
      .where(and(...conditions))
      .groupBy(courses.id, courses.organizationId, courses.name, courses.slug, organizations.name)
      .orderBy(asc(courses.name))
      .limit(parsed.data.limit)
      .offset(parsed.data.offset);

    return reply.status(200).send({ courses: rows, limit: parsed.data.limit, offset: parsed.data.offset });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while fetching courses.' });
  }
}

export async function handleGetCourse(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { courseId } = z.object({ courseId: z.string().uuid() }).parse(request.params);
    const [course] = await db
      .select({ course: courses, organization: { id: organizations.id, name: organizations.name, slug: organizations.slug } })
      .from(courses)
      .innerJoin(organizations, eq(courses.organizationId, organizations.id))
      .where(eq(courses.id, courseId))
      .limit(1);

    if (!course) return reply.status(404).send({ error: 'Course not found.' });

    const rank = await getOrganizationRank(request, course.course.organizationId);
    if (rank < 1) return reply.status(403).send({ error: 'Forbidden', message: 'Join a campus of this school first.' });

    return reply.status(200).send({ course: course.course, organization: course.organization });
  } catch (error) {
    if (error instanceof z.ZodError) return reply.status(400).send({ error: 'Invalid course id.' });
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while fetching the course.' });
  }
}

export async function handleCreateCourse(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsed = createCourseSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    const rank = await getOrganizationRank(request, parsed.data.organizationId);
    if (rank < 1) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Join a campus of this school first.' });
    }

    const [organization] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, parsed.data.organizationId)).limit(1);
    if (!organization) return reply.status(400).send({ error: 'Unknown organizationId.' });

    const slug = parsed.data.slug ?? slugify(parsed.data.name);
    if (!isValidSlug(slug)) {
      return reply.status(400).send({ error: 'Course name produced an invalid slug.' });
    }

    const [created] = await db
      .insert(courses)
      .values({ organizationId: organization.id, name: parsed.data.name, slug })
      .returning();

    return reply.status(201).send({ message: 'Course created successfully!', course: created });
  } catch (error) {
    request.log.error(error);
    if ((error as { code?: string }).code === '23505') {
      return reply.status(409).send({ error: 'This school already has a course with this slug.' });
    }
    return reply.status(500).send({ error: 'Internal server error while creating the course.' });
  }
}
