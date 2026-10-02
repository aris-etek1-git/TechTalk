import { FastifyReply, FastifyRequest } from 'fastify';
import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/db.js';
import { projects, users } from '../db/schema.js';

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(12),
  q: z.string().trim().max(80).optional(),
  status: z.enum(['idea', 'planned', 'in_progress', 'completed', 'abandoned']).optional(),
});

function badRequest(reply: FastifyReply, error: z.ZodError) {
  return reply
    .status(400)
    .send({ error: 'Validation failed', message: error.issues[0]?.message, fields: error.flatten().fieldErrors });
}

/**
 * §19 / §48: only projects a student explicitly marked public are discoverable.
 * This is the read surface the Explorer hub and the Projects page share; creating
 * and editing a project lives behind the owner's own session.
 */
export async function handleListPublicProjects(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) return badRequest(reply, parsed.error);

    const { limit, q, status } = parsed.data;
    const conditions = [eq(projects.visibility, 'public')];
    if (status) conditions.push(eq(projects.status, status));
    if (q) {
      const needle = `%${q}%`;
      conditions.push(or(ilike(projects.name, needle), ilike(projects.description, needle))!);
    }

    const rows = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        technologies: projects.technologies,
        repositoryUrl: projects.repositoryUrl,
        demoUrl: projects.demoUrl,
        status: projects.status,
        createdAt: projects.createdAt,
        owner: { id: users.id, name: users.name, picture: users.picture },
      })
      .from(projects)
      .innerJoin(users, eq(projects.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(projects.createdAt))
      .limit(limit);

    return reply.status(200).send({ projects: rows, limit });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while fetching projects.' });
  }
}
