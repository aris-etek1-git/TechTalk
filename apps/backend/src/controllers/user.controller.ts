import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { db } from '../db/db.js';
import {
  campuses,
  campusMembers,
  projects,
  tags,
  userInterests,
  userPreferences,
  userProfiles,
  users,
  USER_LEVELS,
  VISIBILITIES,
} from '../db/schema.js';

const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._-]{1,38}[a-z0-9])?$/;

const profileSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => USERNAME_RE.test(v), '3 à 40 caractères : lettres, chiffres, point, tiret ou souligné.')
    .optional(),
  bio: z.string().trim().max(500).nullish(),
  level: z.enum(USER_LEVELS).optional(),
  learningGoals: z.array(z.string().trim().min(2).max(120)).max(12).optional(),
  preferredLanguages: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  visibility: z.enum(VISIBILITIES).optional(),
});

const interestsSchema = z.object({
  tags: z
    .array(z.string().trim().min(1).max(60))
    .max(40, 'Au maximum 40 centres d’intérêt.')
    .refine((list) => new Set(list).size === list.length, 'Doublons non autorisés.'),
});

// Preferences are switches, not documents: accepting nested objects would let a
// client grow the column into a place to stash anything.
const preferencesSchema = z.object({
  settings: z.record(z.union([z.boolean(), z.string().max(120), z.number(), z.array(z.string().max(60))])),
});

const onboardingSchema = profileSchema
  .omit({ visibility: true })
  .partial({ username: true })
  .extend({ tags: interestsSchema.shape.tags })
  .extend({ skipped: z.boolean().optional() });

const handleParamSchema = z.object({ handle: z.string().trim().min(1).max(60) });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A profile is addressed by its username, but callers also hold raw ids. */
function handleCondition(handle: string) {
  return UUID_RE.test(handle) ? or(eq(users.id, handle), eq(users.username, handle)) : eq(users.username, handle);
}

/**
 * Write the interest set in one place so the onboarding flow and the dedicated
 * route cannot drift apart on which slugs are acceptable.
 */
async function replaceInterests(ownerId: string, slugs: string[]): Promise<{ ok: boolean; unknown: string[] }> {
  const known = slugs.length
    ? await db.select({ id: tags.id, slug: tags.slug }).from(tags).where(inArray(tags.slug, slugs))
    : [];
  const knownSet = new Set(known.map((row) => row.slug));
  const unknown = slugs.filter((slug) => !knownSet.has(slug));
  if (unknown.length > 0) return { ok: false, unknown };

  await db.transaction(async (tx) => {
    await tx.delete(userInterests).where(eq(userInterests.userId, ownerId));
    if (known.length > 0) {
      await tx.insert(userInterests).values(known.map((row) => ({ userId: ownerId, tagId: row.id })));
    }
  });
  return { ok: true, unknown: [] };
}

function badRequest(reply: FastifyReply, error: z.ZodError) {
  return reply
    .status(400)
    .send({ error: 'Validation failed', message: error.issues[0]?.message, fields: error.flatten().fieldErrors });
}

function actorId(request: FastifyRequest): string {
  return (request.user as { id: string }).id;
}

/**
 * Accounts created before §14 have no profile row, and every pedagogical field
 * has to default somewhere — §48 says that default is private. Creating the row
 * on first read keeps one code path instead of a null profile everywhere.
 */
async function ensureProfile(ownerId: string) {
  const [existing] = await db.select().from(userProfiles).where(eq(userProfiles.userId, ownerId)).limit(1);
  if (existing) return existing;

  const [created] = await db.insert(userProfiles).values({ userId: ownerId }).onConflictDoNothing().returning();
  if (created) return created;

  const [row] = await db.select().from(userProfiles).where(eq(userProfiles.userId, ownerId)).limit(1);
  return row;
}

function interestsOf(ownerId: string) {
  return db
    .select({ id: tags.id, slug: tags.slug, name: tags.name, kind: tags.kind })
    .from(userInterests)
    .innerJoin(tags, eq(userInterests.tagId, tags.id))
    .where(eq(userInterests.userId, ownerId))
    .orderBy(tags.name);
}

async function preferencesOf(ownerId: string): Promise<Record<string, unknown>> {
  const [row] = await db.select().from(userPreferences).where(eq(userPreferences.userId, ownerId)).limit(1);
  return (row?.settings as Record<string, unknown>) ?? {};
}

function publicProjectsOf(ownerId: string) {
  return db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      technologies: projects.technologies,
      repositoryUrl: projects.repositoryUrl,
      demoUrl: projects.demoUrl,
      status: projects.status,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .where(and(eq(projects.userId, ownerId), eq(projects.visibility, 'public')))
    .orderBy(sql`${projects.createdAt} desc`)
    .limit(12);
}

/**
 * Two people belong to the same school when a campus each of them joined shares
 * an organization. One grouped query answers it: the group has to hold both ids.
 */
async function sharesOrganization(viewerId: string, ownerId: string): Promise<boolean> {
  const rows = await db
    .select({ organizationId: campuses.organizationId })
    .from(campusMembers)
    .innerJoin(campuses, eq(campusMembers.campusId, campuses.id))
    .where(inArray(campusMembers.userId, [viewerId, ownerId]))
    .groupBy(campuses.organizationId)
    .having(sql`count(distinct ${campusMembers.userId}) = 2`);

  return rows.length > 0;
}

export async function handleGetMyProfile(request: FastifyRequest, reply: FastifyReply) {
  try {
    const id = actorId(request);
    const [profile, identities, interests, settings] = await Promise.all([
      ensureProfile(id),
      db.select().from(users).where(eq(users.id, id)).limit(1),
      interestsOf(id),
      preferencesOf(id),
    ]);

    const identity = identities[0];
    return reply.status(200).send({
      profile,
      user: identity
        ? { id: identity.id, name: identity.name, email: identity.email, username: identity.username, picture: identity.picture }
        : null,
      interests,
      settings,
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while fetching your profile.' });
  }
}

export async function handleUpdateMyProfile(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsed = profileSchema.safeParse(request.body);
    if (!parsed.success) return badRequest(reply, parsed.error);

    const id = actorId(request);
    const { username, ...rest } = parsed.data;
    if (Object.keys(rest).length === 0 && username === undefined) {
      return reply.status(400).send({ error: 'Nothing to update.' });
    }

    await ensureProfile(id);

    if (username !== undefined) {
      const taken = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.username, username), sql`${users.id} <> ${id}`))
        .limit(1);
      if (taken.length > 0) {
        return reply.status(409).send({ error: 'Conflict', message: "Ce nom d'utilisateur est déjà pris." });
      }
      await db.update(users).set({ username }).where(eq(users.id, id));
    }

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (rest.bio !== undefined) set.bio = rest.bio;
    if (rest.level !== undefined) set.level = rest.level;
    if (rest.learningGoals !== undefined) set.learningGoals = rest.learningGoals;
    if (rest.preferredLanguages !== undefined) set.preferredLanguages = rest.preferredLanguages;
    if (rest.visibility !== undefined) set.visibility = rest.visibility;

    const [profile] = await db.update(userProfiles).set(set).where(eq(userProfiles.userId, id)).returning();
    const interests = await interestsOf(id);

    return reply.status(200).send({ message: 'Profil mis à jour.', profile, interests });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while updating your profile.' });
  }
}

export async function handleGetMyInterests(request: FastifyRequest, reply: FastifyReply) {
  try {
    return reply.status(200).send({ tags: await interestsOf(actorId(request)) });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while fetching your interests.' });
  }
}

/**
 * Replace the whole interest set (§16 lets the picker be revised at any time).
 * Slugs must already exist: minting a tag from a typo would fork the taxonomy
 * and split every later recommendation across two identifiers.
 */
export async function handleReplaceMyInterests(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsed = interestsSchema.safeParse(request.body);
    if (!parsed.success) return badRequest(reply, parsed.error);

    const id = actorId(request);
    const result = await replaceInterests(id, parsed.data.tags);
    if (!result.ok) {
      return reply.status(400).send({
        error: 'Unknown tags',
        message: `Tags inconnus: ${result.unknown.join(', ')}.`,
      });
    }

    return reply.status(200).send({ message: 'Centres d’intérêt enregistrés.', tags: await interestsOf(id) });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while saving your interests.' });
  }
}

export async function handleUpdateMyPreferences(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsed = preferencesSchema.safeParse(request.body);
    if (!parsed.success) return badRequest(reply, parsed.error);

    const id = actorId(request);
    const [row] = await db
      .insert(userPreferences)
      .values({ userId: id, settings: parsed.data.settings })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: { settings: sql`coalesce(${userPreferences.settings}, '{}'::jsonb) || ${JSON.stringify(parsed.data.settings)}::jsonb`, updatedAt: new Date() },
      })
      .returning();

    return reply.status(200).send({ message: 'Préférences enregistrées.', settings: row?.settings ?? {} });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while saving your preferences.' });
  }
}

/**
 * §16 ends with goals and interests recorded at once, and each step may be
 * skipped. `onboarded_at` is what lets the app stop nagging without losing the
 * fields the user did fill in.
 */
export async function handleCompleteOnboarding(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsed = onboardingSchema.safeParse(request.body);
    if (!parsed.success) return badRequest(reply, parsed.error);

    const id = actorId(request);
    const { username, tags: slugs, skipped, ...profileFields } = parsed.data;

    if (username) {
      const taken = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.username, username), sql`${users.id} <> ${id}`))
        .limit(1);
      if (taken.length > 0) {
        return reply.status(409).send({ error: 'Conflict', message: "Ce nom d'utilisateur est déjà pris." });
      }
      await db.update(users).set({ username }).where(eq(users.id, id));
    }

    await ensureProfile(id);

    const set: Record<string, unknown> = { updatedAt: new Date() };
    // Skipping the flow records nothing: a step the user postponed is not done,
    // so the app is allowed to ask again later.
    if (!skipped) set.onboardedAt = new Date();
    if (profileFields.bio !== undefined) set.bio = profileFields.bio;
    if (profileFields.level !== undefined) set.level = profileFields.level;
    if (profileFields.learningGoals !== undefined) set.learningGoals = profileFields.learningGoals;
    if (profileFields.preferredLanguages !== undefined) set.preferredLanguages = profileFields.preferredLanguages;

    const [profile] = await db.update(userProfiles).set(set).where(eq(userProfiles.userId, id)).returning();

    if (slugs && slugs.length > 0) {
      const result = await replaceInterests(id, slugs);
      if (!result.ok) {
        return reply.status(400).send({
          error: 'Unknown tags',
          message: `Tags inconnus: ${result.unknown.join(', ')}.`,
        });
      }
    }

    const interests = await interestsOf(id);
    return reply.status(200).send({ message: 'Onboarding enregistré.', profile, interests });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while finishing onboarding.' });
  }
}

/**
 * §47 shows a profile to others; §48 decides who may see it. `school_only` is
 * resolved against shared campuses, and a private profile answers 404 rather
 * than 403 so a probe cannot list which accounts exist.
 */
export async function handleGetPublicProfile(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsed = handleParamSchema.safeParse(request.params);
    if (!parsed.success) return badRequest(reply, parsed.error);

    const handle = parsed.data.handle.toLowerCase();
    const [target] = await db
      .select()
      .from(users)
      .where(handleCondition(handle))
      .limit(1);
    if (!target) return reply.status(404).send({ error: 'Not found', message: 'Profil introuvable.' });

    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, target.id)).limit(1);
    const visibility = profile?.visibility ?? 'private';
    const viewerId = (request.user as { id?: string } | undefined)?.id;

    if (viewerId === target.id) {
      // fall through: the owner always sees their own profile
    } else if (visibility === 'private') {
      return reply.status(404).send({ error: 'Not found', message: 'Profil introuvable.' });
    } else if (visibility === 'school_only') {
      const sameSchool = viewerId ? await sharesOrganization(viewerId, target.id) : false;
      if (!sameSchool) {
        return reply.status(403).send({ error: 'Forbidden', message: 'Ce profil est réservé aux étudiants de son école.' });
      }
    }

    const [interests, projectRows] = await Promise.all([interestsOf(target.id), publicProjectsOf(target.id)]);

    return reply.status(200).send({
      user: {
        id: target.id,
        name: target.name,
        username: target.username,
        picture: target.picture,
        createdAt: target.createdAt,
      },
      profile: profile
        ? {
            bio: profile.bio,
            level: profile.level,
            learningGoals: profile.learningGoals,
            preferredLanguages: profile.preferredLanguages,
            visibility: profile.visibility,
            onboardedAt: profile.onboardedAt,
          }
        : null,
      interests,
      projects: projectRows,
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while fetching the profile.' });
  }
}
