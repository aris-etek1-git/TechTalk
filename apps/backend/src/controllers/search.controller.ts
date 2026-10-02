import { FastifyReply, FastifyRequest } from 'fastify';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/db.js';
import { contents, projects, tags, users } from '../db/schema.js';

const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(80),
  limit: z.coerce.number().int().min(1).max(30).default(8),
});

function badRequest(reply: FastifyReply, error: z.ZodError) {
  return reply
    .status(400)
    .send({ error: 'Validation failed', message: error.issues[0]?.message, fields: error.flatten().fieldErrors });
}

/**
 * §35 / §56: one query, several entity kinds. This is the endpoint behind a
 * global search box; the Explorer hub renders the groups it returns.
 */
export async function handleGlobalSearch(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsed = searchQuerySchema.safeParse(request.query);
    if (!parsed.success) return badRequest(reply, parsed.error);

    const { q, limit } = parsed.data;
    const needle = `%${q}%`;

    const [contents_, matchedTags, publicProjects] = await Promise.all([
      db
        .select({
          id: contents.id,
          title: contents.title,
          summary: contents.summary,
          source: contents.source,
          type: contents.type,
          url: contents.url,
          image: contents.image,
          author: contents.author,
          categories: contents.categories,
          createdAt: contents.createdAt,
        })
        .from(contents)
        .where(or(ilike(contents.title, needle), ilike(contents.summary, needle), ilike(contents.source, needle)))
        .orderBy(desc(contents.createdAt))
        .limit(limit),
      db
        .select({ id: tags.id, slug: tags.slug, name: tags.name, kind: tags.kind, usageCount: tags.usageCount })
        .from(tags)
        .where(or(ilike(tags.name, needle), ilike(tags.slug, needle)))
        .orderBy(sql`${tags.usageCount} desc`)
        .limit(limit),
      db
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
        .where(
          and(
            eq(projects.visibility, 'public'),
            or(ilike(projects.name, needle), ilike(projects.description, needle))
          )
        )
        .orderBy(desc(projects.createdAt))
        .limit(limit),
    ]);

    return reply.status(200).send({ query: q, contents: contents_, tags: matchedTags, projects: publicProjects });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while searching.' });
  }
}
