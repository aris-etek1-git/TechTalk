import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { db } from '../db/db.js';
import { contentTags, contents, tags, TAG_KINDS } from '../db/schema.js';
import { rebuildTagUsageCounts, tagUntaggedContents } from '../services/taxonomy.js';

const listQuerySchema = z.object({
  kind: z.enum(TAG_KINDS).optional(),
  q: z.string().trim().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
});

const slugParamSchema = z.object({ slug: z.string().trim().min(1).max(60) });

const contentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
});

function badRequest(reply: FastifyReply, error: z.ZodError) {
  return reply.status(400).send({ error: 'Validation failed', message: error.issues[0]?.message, fields: error.flatten().fieldErrors });
}

/**
 * §69 lists Topics as a discovery surface, and the onboarding picker needs the
 * same list. Without `q` this is a trending ranking; with it, a search.
 */
export async function handleListTags(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) return badRequest(reply, parsed.error);

    const { kind, q, limit } = parsed.data;
    const conditions = [];
    if (kind) conditions.push(eq(tags.kind, kind));
    if (q) {
      conditions.push(or(ilike(tags.name, `%${q}%`), ilike(tags.slug, `%${q}%`))!);
    }

    const rows = await db
      .select()
      .from(tags)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(tags.usageCount), tags.name)
      .limit(limit);

    return reply.status(200).send({ tags: rows, limit });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while fetching tags.' });
  }
}

/** Contents carrying one tag, newest first — the body of a topic page. */
export async function handleGetTagContents(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsedParams = slugParamSchema.safeParse(request.params);
    if (!parsedParams.success) return badRequest(reply, parsedParams.error);

    const parsed = contentsQuerySchema.safeParse(request.query);
    if (!parsed.success) return badRequest(reply, parsed.error);

    const [tag] = await db.select().from(tags).where(eq(tags.slug, parsedParams.data.slug)).limit(1);
    if (!tag) return reply.status(404).send({ error: 'Not found', message: 'Unknown tag.' });

    const { limit, offset } = parsed.data;
    const rows = await db
      .select({
        id: contents.id,
        title: contents.title,
        url: contents.url,
        source: contents.source,
        type: contents.type,
        summary: contents.summary,
        image: contents.image,
        author: contents.author,
        publishedAt: contents.publishedAt,
        createdAt: contents.createdAt,
      })
      .from(contentTags)
      .innerJoin(contents, eq(contentTags.contentId, contents.id))
      .where(eq(contentTags.tagId, tag.id))
      .orderBy(desc(contents.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(contentTags)
      .where(eq(contentTags.tagId, tag.id));

    return reply.status(200).send({ tag, contents: rows, total, limit, offset });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while fetching tagged contents.' });
  }
}

/**
 * Derive tags for contents that arrived before the taxonomy existed, then
 * recompute every usage count from the join table. Admin-only: it is a write
 * over the whole catalog, not a read.
 */
export async function handleBackfillTags(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsed = z.object({ limit: z.coerce.number().int().min(1).max(5000).default(1000) }).safeParse(request.query);
    if (!parsed.success) return badRequest(reply, parsed.error);

    const tagged = await tagUntaggedContents(parsed.data.limit);
    await rebuildTagUsageCounts();

    return reply.status(200).send({ message: 'Tag backfill finished.', tagged });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while backfilling tags.' });
  }
}
