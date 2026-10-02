import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { db } from '../db/db.js';
import { contents, contentTags, interactions, INTERACTION_TYPES, tags } from '../db/schema.js';

// §80: the columns this log keeps are exactly the ones a future model needs, so
// nothing here is invented for a UI and nothing is dropped that training wants.
const contextValue = z.union([z.boolean(), z.string().max(200), z.number()]);

const itemSchema = z.object({
  contentId: z.string().uuid(),
  type: z.enum(INTERACTION_TYPES),
  watchTimeSeconds: z.coerce.number().int().min(0).max(86400).nullish(),
  completionRate: z.coerce.number().min(0).max(1).nullish(),
  surface: z.enum(['feed', 'shorts', 'search', 'explore', 'content', 'topic', 'push']).nullish(),
  context: z.record(contextValue).nullish(),
});

const batchSchema = z.object({
  items: z.array(itemSchema).min(1).max(100, 'Send at most 100 interactions per request.'),
});

const listQuerySchema = z.object({
  type: z.enum(INTERACTION_TYPES).optional(),
  since: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

function badRequest(reply: FastifyReply, error: z.ZodError) {
  return reply
    .status(400)
    .send({ error: 'Validation failed', message: error.issues[0]?.message, fields: error.flatten().fieldErrors });
}

/**
 * Append behavioural signals (§13 level 3). The log is append-only and this
 * never updates a previous row, so a like followed by an unlike stays visible
 * to whoever reads the history later.
 *
 * Content ids are checked before inserting: an unknown id is a broken client or
 * a deleted item, and a foreign key violation would fail the whole batch.
 */
export async function handleRecordInteractions(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsed = batchSchema.safeParse(request.body);
    if (!parsed.success) return badRequest(reply, parsed.error);

    const userId = (request.user as { id: string }).id;
    const ids = Array.from(new Set(parsed.data.items.map((item) => item.contentId)));
    const existing = await db.select({ id: contents.id }).from(contents).where(inArray(contents.id, ids));
    const valid = new Set(existing.map((row) => row.id));

    const rows = parsed.data.items
      .filter((item) => valid.has(item.contentId))
      .map((item) => ({
        userId,
        contentId: item.contentId,
        type: item.type,
        watchTimeSeconds: item.watchTimeSeconds ?? null,
        completionRate: item.completionRate ?? null,
        surface: item.surface ?? null,
        context: item.context ?? {},
      }));

    if (rows.length === 0) {
      return reply.status(422).send({
        error: 'Unprocessable',
        message: 'None of the referenced contents exist.',
        dropped: ids.length,
      });
    }

    const inserted = await db.insert(interactions).values(rows).returning({ id: interactions.id });

    return reply.status(201).send({
      message: 'Interactions recorded.',
      recorded: inserted.length,
      dropped: parsed.data.items.length - inserted.length,
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while recording interactions.' });
  }
}

/** The caller's own history, with enough content detail to render a list. */
export async function handleListMyInteractions(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) return badRequest(reply, parsed.error);

    const userId = (request.user as { id: string }).id;
    const { type, since, limit } = parsed.data;

    const conditions = [eq(interactions.userId, userId)];
    if (type) conditions.push(eq(interactions.type, type));
    if (since) conditions.push(gte(interactions.createdAt, since));

    const rows = await db
      .select({
        id: interactions.id,
        type: interactions.type,
        surface: interactions.surface,
        watchTimeSeconds: interactions.watchTimeSeconds,
        completionRate: interactions.completionRate,
        createdAt: interactions.createdAt,
        contentId: contents.id,
        title: contents.title,
        url: contents.url,
        source: contents.source,
        typeOfContent: contents.type,
        image: contents.image,
      })
      .from(interactions)
      .innerJoin(contents, eq(interactions.contentId, contents.id))
      .where(and(...conditions))
      .orderBy(desc(interactions.createdAt))
      .limit(limit);

    return reply.status(200).send({ interactions: rows, limit });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while fetching your interactions.' });
  }
}

/**
 * Signal totals behind the personal feed. Exposed because §82 asks for
 * transparency: a user is entitled to see which topics their behaviour is
 * actually reinforcing, and this is the same data the scorer reads.
 */
export async function handleMyInteractionSummary(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request.user as { id: string }).id;
    const { days } = z
      .object({ days: z.coerce.number().int().min(1).max(365).default(30) })
      .parse(request.query);
    const since = new Date(Date.now() - days * 86400_000);

    const [byType, byTag] = await Promise.all([
      db
        .select({ type: interactions.type, count: sql<number>`count(*)::int` })
        .from(interactions)
        .where(and(eq(interactions.userId, userId), gte(interactions.createdAt, since)))
        .groupBy(interactions.type),
      db
        .select({
          slug: tags.slug,
          name: tags.name,
          count: sql<number>`count(*)::int`,
        })
        .from(interactions)
        .innerJoin(contentTags, eq(interactions.contentId, contentTags.contentId))
        .innerJoin(tags, eq(contentTags.tagId, tags.id))
        .where(and(eq(interactions.userId, userId), gte(interactions.createdAt, since)))
        .groupBy(tags.slug, tags.name)
        .orderBy(sql`count(*) desc`)
        .limit(12),
    ]);

    return reply.status(200).send({
      days,
      totals: byType.map((row) => ({ type: row.type, count: row.count })),
      topTags: byTag.map((row) => ({ slug: row.slug, name: row.name, count: row.count })),
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while summarising your activity.' });
  }
}
