import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { buildFeedPage } from '../services/feed.js';
import { decodeCursor } from '../services/feed.js';

const feedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(8).max(200).optional(),
  type: z.enum(['article', 'video', 'social_post']).optional(),
  source: z.string().trim().max(100).optional(),
  // The vertical feed only wants the short cuts; a long YouTube video in the
  // middle of it breaks the scroll without teaching anything.
  shape: z.enum(['short', 'long']).optional(),
  // The subscription tab shows nothing but what the caller asked for (§10).
  match: z.enum(['all', 'interests']).optional(),
});

/**
 * §10: the discovery feed. Ranking is hybrid (§11 level 4) — the caller's
 * interests, the item's freshness and like count, and what the caller already
 * did with it. Every item carries `reasons` so the ranking can be questioned.
 */
export async function handleGetFeed(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsed = feedQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: 'Validation failed', message: parsed.error.issues[0]?.message, fields: parsed.error.flatten().fieldErrors });
    }

    if (parsed.data.cursor && !decodeCursor(parsed.data.cursor)) {
      return reply.status(400).send({ error: 'Validation failed', message: 'Curseur invalide.' });
    }

    const userId = (request.user as { id?: string } | undefined)?.id ?? null;
    const page = await buildFeedPage({
      userId,
      limit: parsed.data.limit,
      cursor: parsed.data.cursor,
      type: parsed.data.type,
      source: parsed.data.source,
      shape: parsed.data.shape,
      onlyMatched: parsed.data.match === 'interests' && userId !== null,
    });

    return reply.status(200).send(page);
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while building your feed.' });
  }
}
