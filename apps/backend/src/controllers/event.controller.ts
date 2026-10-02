import { FastifyReply, FastifyRequest } from 'fastify';
import { and, asc, count, eq, gte, inArray, lt } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/db.js';
import { campuses, eventRsvps, events, groups, users } from '../db/schema.js';
import { CAMPUS_ROLE_RANK, isPlatformAdmin, loadAccessForCampus, loadCampusAccess } from '../plugins/campus-access.js';

const campusParam = z.object({ campusId: z.string().uuid() });
const eventIdParam = z.object({ eventId: z.string().uuid() });

const RSVP_STATUSES = ['going', 'interested'] as const;

const eventBodySchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(2000).optional(),
  location: z.string().trim().min(2).max(200),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().optional(),
  capacity: z.coerce.number().int().min(1).max(10000).nullable().optional(),
  groupId: z.string().uuid().optional(),
});

const createEventSchema = eventBodySchema.refine((data) => !data.endsAt || data.endsAt > data.startsAt, {
  message: 'endsAt must be after startsAt.',
  path: ['endsAt'],
});

// A partial update can carry only one of the two bounds, so the pair is checked
// against the stored row in the handler instead. 'status' is how an organizer
// cancels an event without deleting its RSVP history.
const updateEventSchema = eventBodySchema
  .partial()
  .extend({ status: z.enum(['scheduled', 'cancelled']).optional() });

const listQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  status: z.enum(['scheduled', 'cancelled']).optional(),
  includePast: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
});

const rsvpSchema = z.object({ status: z.enum(RSVP_STATUSES) });

function validationError(reply: FastifyReply, error: z.ZodError) {
  return reply.status(400).send({ error: 'Validation failed', fields: error.flatten().fieldErrors });
}

function badUuid(reply: FastifyReply) {
  return reply.status(400).send({ error: 'Invalid identifier.' });
}

function currentUserId(request: FastifyRequest): string {
  return (request.user as { id: string }).id;
}

interface EventScope {
  event: typeof events.$inferSelect;
  rank: number;
  isPlatformAdmin: boolean;
}

/**
 * Load an event with the caller's standing over whatever gates it. A campus
 * event needs membership; a school-wide or TechTalk-published one (§44) has no
 * campus row to check, so any signed-in user may read and RSVP to it.
 */
async function resolveEvent(request: FastifyRequest, eventId: string): Promise<EventScope | null> {
  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) return null;

  if (!event.campusId) {
    return { event, rank: CAMPUS_ROLE_RANK.member, isPlatformAdmin: isPlatformAdmin(request) };
  }

  const access = await loadAccessForCampus(request, event.campusId);
  // A missing campus row makes the event unreachable, not public.
  if (!access) return null;
  return { event, rank: access.rank, isPlatformAdmin: access.isPlatformAdmin };
}

function canManageEvent(event: typeof events.$inferSelect, rank: number, isPlatformAdmin: boolean, userId: string) {
  return isPlatformAdmin || rank >= CAMPUS_ROLE_RANK.moderator || event.createdBy === userId;
}

async function rsvpSummary(eventIds: string[], userId: string) {
  const going = new Map<string, number>();
  const mine = new Map<string, string>();
  if (eventIds.length === 0) return { going, mine };

  const tallies = await db
    .select({ eventId: eventRsvps.eventId, goingCount: count() })
    .from(eventRsvps)
    .where(and(inArray(eventRsvps.eventId, eventIds), eq(eventRsvps.status, 'going')))
    .groupBy(eventRsvps.eventId);
  for (const row of tallies) going.set(row.eventId, row.goingCount);

  const own = await db
    .select({ eventId: eventRsvps.eventId, status: eventRsvps.status })
    .from(eventRsvps)
    .where(and(inArray(eventRsvps.eventId, eventIds), eq(eventRsvps.userId, userId)));
  for (const row of own) mine.set(row.eventId, row.status);

  return { going, mine };
}

function shapeEvent(
  event: typeof events.$inferSelect,
  summary: { going: Map<string, number>; mine: Map<string, string> },
  campus?: Record<string, unknown>
) {
  return {
    ...event,
    goingCount: summary.going.get(event.id) ?? 0,
    myRsvp: summary.mine.get(event.id) ?? null,
    seatsLeft: event.capacity === null ? null : Math.max(0, event.capacity - (summary.going.get(event.id) ?? 0)),
    ...(campus && { campus }),
  };
}

export async function handleListCampusEvents(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsedParams = campusParam.safeParse(request.params);
    if (!parsedParams.success) return badUuid(reply);

    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) return validationError(reply, parsed.error);

    const access = request.campusAccess ?? (await loadCampusAccess(request));
    if (!access) return reply.status(404).send({ error: 'Campus not found.' });

    const { from, to, status, includePast, limit, offset } = parsed.data;
    const conditions = [eq(events.campusId, access.campus.id)];

    // The default view is "what is coming up", so the past has to be asked for.
    if (from) conditions.push(gte(events.startsAt, from));
    else if (!includePast) conditions.push(gte(events.startsAt, new Date()));
    if (to) conditions.push(lt(events.startsAt, to));
    conditions.push(status ? eq(events.status, status) : eq(events.status, 'scheduled'));

    const rows = await db
      .select({ event: events })
      .from(events)
      .where(and(...conditions))
      .orderBy(asc(events.startsAt))
      .limit(limit)
      .offset(offset);

    const ids = rows.map((row) => row.event.id);
    const summary = await rsvpSummary(ids, currentUserId(request));

    return reply.status(200).send({ events: rows.map((row) => shapeEvent(row.event, summary)), limit, offset });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while fetching events.' });
  }
}

/** Events the caller organized or RSVP'd to, across every campus they belong to. */
export async function handleListMyEvents(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = currentUserId(request);
    const [rsvps, hosted] = await Promise.all([
      db.select({ eventId: eventRsvps.eventId }).from(eventRsvps).where(eq(eventRsvps.userId, userId)),
      db.select({ id: events.id }).from(events).where(eq(events.createdBy, userId)),
    ]);

    const ids = Array.from(new Set([...rsvps.map((row) => row.eventId), ...hosted.map((row) => row.id)]));
    if (ids.length === 0) return reply.status(200).send({ events: [] });

    const rows = await db
      .select({
        event: events,
        campus: { id: campuses.id, name: campuses.name, slug: campuses.slug, city: campuses.city },
      })
      .from(events)
      .innerJoin(campuses, eq(events.campusId, campuses.id))
      .where(inArray(events.id, ids))
      .orderBy(asc(events.startsAt))
      .limit(50);

    const summary = await rsvpSummary(rows.map((row) => row.event.id), userId);

    return reply.status(200).send({ events: rows.map((row) => shapeEvent(row.event, summary, row.campus)) });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while fetching your events.' });
  }
}

export async function handleGetEvent(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsedParams = eventIdParam.safeParse(request.params);
    if (!parsedParams.success) return badUuid(reply);

    const resolved = await resolveEvent(request, parsedParams.data.eventId);
    if (!resolved) return reply.status(404).send({ error: 'Event not found.' });
    if (resolved.rank < CAMPUS_ROLE_RANK.member) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Join the campus first.' });
    }

    const summary = await rsvpSummary([resolved.event.id], currentUserId(request));
    const attendees = await db
      .select({ userId: eventRsvps.userId, status: eventRsvps.status, name: users.name, picture: users.picture })
      .from(eventRsvps)
      .innerJoin(users, eq(eventRsvps.userId, users.id))
      .where(eq(eventRsvps.eventId, resolved.event.id))
      .orderBy(asc(eventRsvps.createdAt))
      .limit(50);

    return reply.status(200).send({ event: shapeEvent(resolved.event, summary), attendees });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while fetching the event.' });
  }
}

export async function handleCreateEvent(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsedParams = campusParam.safeParse(request.params);
    if (!parsedParams.success) return badUuid(reply);

    const parsed = createEventSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    const access = request.campusAccess ?? (await loadCampusAccess(request));
    if (!access) return reply.status(404).send({ error: 'Campus not found.' });

    const userId = currentUserId(request);
    if (parsed.data.startsAt.getTime() < Date.now()) {
      return reply.status(400).send({ error: 'startsAt has to be in the future.' });
    }

    if (parsed.data.groupId) {
      const [group] = await db.select().from(groups).where(eq(groups.id, parsed.data.groupId)).limit(1);
      if (!group) return reply.status(400).send({ error: 'Unknown groupId.' });
      // A group of another campus has no business hosting an event here.
      if (group.campusId !== access.campus.id) {
        return reply.status(403).send({ error: 'That group does not belong to this campus.' });
      }
    }

    const [created] = await db
      .insert(events)
      .values({
        campusId: access.campus.id,
        groupId: parsed.data.groupId ?? null,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        location: parsed.data.location,
        startsAt: parsed.data.startsAt,
        endsAt: parsed.data.endsAt ?? null,
        capacity: parsed.data.capacity ?? null,
        createdBy: userId,
      })
      .returning();

    const summary = await rsvpSummary([created.id], userId);
    return reply.status(201).send({ message: 'Event created successfully!', event: shapeEvent(created, summary) });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while creating the event.' });
  }
}

export async function handleUpdateEvent(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsedParams = eventIdParam.safeParse(request.params);
    if (!parsedParams.success) return badUuid(reply);

    const parsed = updateEventSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    const resolved = await resolveEvent(request, parsedParams.data.eventId);
    if (!resolved) return reply.status(404).send({ error: 'Event not found.' });

    const userId = currentUserId(request);
    if (!canManageEvent(resolved.event, resolved.rank, resolved.isPlatformAdmin, userId)) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Organizers and campus moderators only.' });
    }

    const set: Partial<typeof events.$inferInsert> = {};
    if (parsed.data.title !== undefined) set.title = parsed.data.title;
    if (parsed.data.description !== undefined) set.description = parsed.data.description;
    if (parsed.data.location !== undefined) set.location = parsed.data.location;
    if (parsed.data.startsAt !== undefined) set.startsAt = parsed.data.startsAt;
    if (parsed.data.endsAt !== undefined) set.endsAt = parsed.data.endsAt;
    if (parsed.data.capacity !== undefined) set.capacity = parsed.data.capacity ?? null;
    if (parsed.data.status !== undefined) set.status = parsed.data.status;
    if (Object.keys(set).length === 0) return reply.status(400).send({ error: 'Nothing to update.' });

    const startsAt = set.startsAt ?? resolved.event.startsAt;
    const endsAt = set.endsAt ?? resolved.event.endsAt;
    if (endsAt && endsAt <= startsAt) {
      return reply.status(400).send({ error: 'endsAt must be after startsAt.' });
    }

    const [updated] = await db.update(events).set(set).where(eq(events.id, resolved.event.id)).returning();
    const summary = await rsvpSummary([updated.id], userId);

    return reply.status(200).send({ message: 'Event updated.', event: shapeEvent(updated, summary) });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while updating the event.' });
  }
}

export async function handleRsvpEvent(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsedParams = eventIdParam.safeParse(request.params);
    if (!parsedParams.success) return badUuid(reply);

    const parsed = rsvpSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    const resolved = await resolveEvent(request, parsedParams.data.eventId);
    if (!resolved) return reply.status(404).send({ error: 'Event not found.' });
    if (resolved.rank < CAMPUS_ROLE_RANK.member) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Join the campus first.' });
    }
    if (resolved.event.status === 'cancelled') {
      return reply.status(409).send({ error: 'This event is cancelled.' });
    }

    const userId = currentUserId(request);

    // Only 'going' occupies a seat, and only a change into 'going' needs to check it.
    if (parsed.data.status === 'going' && resolved.event.capacity !== null) {
      const [own] = await db
        .select({ status: eventRsvps.status })
        .from(eventRsvps)
        .where(and(eq(eventRsvps.eventId, resolved.event.id), eq(eventRsvps.userId, userId)))
        .limit(1);

      if (own?.status !== 'going') {
        const [tally] = await db
          .select({ goingCount: count() })
          .from(eventRsvps)
          .where(and(eq(eventRsvps.eventId, resolved.event.id), eq(eventRsvps.status, 'going')));
        if ((tally?.goingCount ?? 0) >= resolved.event.capacity) {
          return reply.status(409).send({ error: 'This event is full.' });
        }
      }
    }

    const [rsvp] = await db
      .insert(eventRsvps)
      .values({ eventId: resolved.event.id, userId, status: parsed.data.status })
      .onConflictDoUpdate({
        target: [eventRsvps.eventId, eventRsvps.userId],
        set: { status: parsed.data.status },
      })
      .returning();

    const summary = await rsvpSummary([resolved.event.id], userId);
    return reply.status(200).send({
      message: 'Response saved.',
      event: shapeEvent(resolved.event, summary),
      rsvp,
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while saving your response.' });
  }
}

export async function handleDeleteRsvp(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsedParams = eventIdParam.safeParse(request.params);
    if (!parsedParams.success) return badUuid(reply);

    const resolved = await resolveEvent(request, parsedParams.data.eventId);
    if (!resolved) return reply.status(404).send({ error: 'Event not found.' });

    const userId = currentUserId(request);
    await db
      .delete(eventRsvps)
      .where(and(eq(eventRsvps.eventId, resolved.event.id), eq(eventRsvps.userId, userId)));

    return reply.status(200).send({ message: 'Your response was removed.' });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while removing your response.' });
  }
}

export async function handleDeleteEvent(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsedParams = eventIdParam.safeParse(request.params);
    if (!parsedParams.success) return badUuid(reply);

    const resolved = await resolveEvent(request, parsedParams.data.eventId);
    if (!resolved) return reply.status(404).send({ error: 'Event not found.' });

    const userId = currentUserId(request);
    if (!canManageEvent(resolved.event, resolved.rank, resolved.isPlatformAdmin, userId)) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Organizers and campus moderators only.' });
    }

    await db.delete(events).where(eq(events.id, resolved.event.id));
    return reply.status(200).send({ message: 'Event removed.' });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while deleting the event.' });
  }
}
