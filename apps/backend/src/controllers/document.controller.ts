import { createHash } from 'node:crypto';
import { FastifyReply, FastifyRequest } from 'fastify';
import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { config } from '../config/env.js';
import { db } from '../db/db.js';
import { courses, documents, organizations } from '../db/schema.js';
import { CAMPUS_ROLE_RANK, getOrganizationRank } from '../plugins/campus-access.js';
import {
  buildStorageKey,
  deleteObject,
  presignDownload,
  putObject,
  safeFileName,
  sniffMimeType,
} from '../services/storage.js';

const DOC_STATUSES = ['pending', 'approved', 'rejected'] as const;
type DocumentStatus = (typeof DOC_STATUSES)[number];

const idParam = z.object({ documentId: z.string().uuid() });
const courseIdParam = z.object({ courseId: z.string().uuid() });

const listQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  period: z.string().trim().max(8).optional(),
  academicYear: z.string().trim().max(9).optional(),
  sort: z.enum(['recent', 'downloads']).default('recent'),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
});

const moderateSchema = z.object({ status: z.enum(DOC_STATUSES) });

/**
 * Extra multipart fields arrive as either a value part or a file part, and the
 * plugin types them as that union, so the narrowing happens here once.
 */
function fieldText(file: NonNullable<Awaited<ReturnType<FastifyRequest['file']>>>, name: string): string {
  const entry = file.fields?.[name];
  if (!entry) return '';
  const first = Array.isArray(entry) ? entry[0] : entry;
  return 'value' in first ? String(first.value ?? '') : '';
}

function validationError(reply: FastifyReply, error: z.ZodError) {
  return reply.status(400).send({ error: 'Validation failed', fields: error.flatten().fieldErrors });
}

/** Resolves a course with the caller's school-wide rank, or null when missing. */
async function resolveCourseAccess(request: FastifyRequest, courseId: string) {
  const [row] = await db
    .select({ course: courses, organizationName: organizations.name })
    .from(courses)
    .innerJoin(organizations, eq(courses.organizationId, organizations.id))
    .where(eq(courses.id, courseId))
    .limit(1);
  if (!row) return null;

  const rank = await getOrganizationRank(request, row.course.organizationId);
  return { course: row.course, organizationName: row.organizationName, rank };
}

function publicShape(row: typeof documents.$inferSelect, userId: string, rank: number) {
  return {
    id: row.id,
    courseId: row.courseId,
    title: row.title,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    period: row.period,
    academicYear: row.academicYear,
    status: row.status,
    downloads: row.downloads,
    uploaderId: row.uploaderId,
    createdAt: row.createdAt,
    isMine: row.uploaderId === userId,
    // The bucket key stays server-side; clients only ever receive signed URLs.
    canModerate: rank >= CAMPUS_ROLE_RANK.moderator,
  };
}

export async function handleListDocuments(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsedParams = courseIdParam.safeParse(request.params);
    if (!parsedParams.success) return reply.status(400).send({ error: 'Invalid course id.' });

    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) return validationError(reply, parsed.error);

    const userId = (request.user as { id: string }).id;
    const access = await resolveCourseAccess(request, parsedParams.data.courseId);
    if (!access) return reply.status(404).send({ error: 'Course not found.' });
    if (access.rank < CAMPUS_ROLE_RANK.member) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Join a campus of this school first.' });
    }

    const { search, period, academicYear, sort, limit, offset } = parsed.data;
    const conditions = [eq(documents.courseId, access.course.id)];

    // Unapproved uploads are visible to their author and to moderators only.
    if (access.rank < CAMPUS_ROLE_RANK.moderator) {
      conditions.push(or(eq(documents.status, 'approved'), eq(documents.uploaderId, userId))!);
    }
    if (search) conditions.push(ilike(documents.title, `%${search}%`));
    if (period) conditions.push(eq(documents.period, period));
    if (academicYear) conditions.push(eq(documents.academicYear, academicYear));

    const order = sort === 'downloads' ? desc(documents.downloads) : desc(documents.createdAt);
    const rows = await db
      .select()
      .from(documents)
      .where(and(...conditions))
      .orderBy(order, asc(documents.title))
      .limit(limit)
      .offset(offset);

    return reply.status(200).send({
      documents: rows.map((row) => publicShape(row, userId, access.rank)),
      limit,
      offset,
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while fetching documents.' });
  }
}

export async function handleUploadDocument(request: FastifyRequest, reply: FastifyReply) {
  let writtenKey: string | null = null;
  try {
    const parsedParams = courseIdParam.safeParse(request.params);
    if (!parsedParams.success) return reply.status(400).send({ error: 'Invalid course id.' });

    // Shape of the request first: a malformed upload costs no query, and the
    // answer is the same whatever the course id, so it leaks nothing. Without
    // it, request.file() throws FST_ERR_CTP_INVALID_MEDIA_TYPE and the client
    // gets a 500 for its own mistake.
    if (!request.isMultipart()) {
      return reply.status(400).send({ error: 'Upload the file as multipart/form-data.' });
    }

    const userId = (request.user as { id: string }).id;
    const access = await resolveCourseAccess(request, parsedParams.data.courseId);
    if (!access) return reply.status(404).send({ error: 'Course not found.' });
    if (access.rank < CAMPUS_ROLE_RANK.member) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Join a campus of this school first.' });
    }

    const file = await request.file();
    if (!file) {
      return reply.status(400).send({ error: 'A multipart file part is required.' });
    }

    const body = await file.toBuffer();
    if (body.byteLength === 0) {
      return reply.status(400).send({ error: 'The uploaded file is empty.' });
    }
    if (body.byteLength > config.storage.maxUploadBytes) {
      return reply.status(413).send({ error: `File larger than ${Math.round(config.storage.maxUploadBytes / 1048576)} MB.` });
    }

    // The signature wins over the declared content type: a browser will label
    // anything as application/pdf if the user renames it.
    const mimeType = sniffMimeType(body);
    if (!mimeType) {
      return reply.status(415).send({ error: 'Unsupported file type. PDF, PNG or JPEG only.' });
    }

    const checksum = createHash('sha256').update(body).digest('hex');
    const [duplicate] = await db
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.courseId, access.course.id), eq(documents.checksum, checksum)))
      .limit(1);
    if (duplicate) {
      return reply.status(409).send({ error: 'This exact file is already attached to this course.' });
    }

    const title = fieldText(file, 'title').trim().slice(0, 200) || safeFileName(file.filename);

    // Optional provenance field, validated like everything else the client sends.
    const rawCampusId = fieldText(file, 'campusId').trim();
    const campusId = z.string().uuid().safeParse(rawCampusId).success ? rawCampusId : null;

    // Both fields are list filters, so an unnormalised value would silently
    // hide a past paper from every search that asks for it.
    const meta = z
      .object({
        period: z.string().regex(/^S[1-9]$/, 'Use S1, S2, …').optional(),
        academicYear: z.string().regex(/^\d{4}-\d{4}$/, 'Use a range like 2025-2026').optional(),
      })
      .safeParse({
        period: fieldText(file, 'period').trim() || undefined,
        academicYear: fieldText(file, 'academicYear').trim() || undefined,
      });
    if (!meta.success) return validationError(reply, meta.error);

    writtenKey = buildStorageKey(access.course.id, checksum, mimeType);
    await putObject(writtenKey, body, mimeType);

    const [created] = await db
      .insert(documents)
      .values({
        courseId: access.course.id,
        title,
        storageKey: writtenKey,
        checksum,
        fileName: safeFileName(file.filename),
        mimeType,
        sizeBytes: body.byteLength,
        uploaderId: userId,
        campusId,
        status: 'pending',
      })
      .onConflictDoNothing()
      .returning();

    if (!created) {
      // Unique index caught a concurrent duplicate: do not leave the object behind.
      await deleteObject(writtenKey).catch(() => undefined);
      writtenKey = null;
      return reply.status(409).send({ error: 'This exact file is already attached to this course.' });
    }

    return reply.status(201).send({
      message: 'Uploaded. A campus moderator has to approve it before it appears for other students.',
      document: publicShape(created, userId, access.rank),
    });
  } catch (error) {
    request.log.error(error);
    if (writtenKey) await deleteObject(writtenKey).catch(() => undefined);
    return reply.status(500).send({ error: 'Internal server error while uploading the document.' });
  }
}

export async function handleDownloadDocument(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsedParams = idParam.safeParse(request.params);
    if (!parsedParams.success) return reply.status(400).send({ error: 'Invalid document id.' });

    const userId = (request.user as { id: string }).id;
    const [row] = await db
      .select({ document: documents, course: courses })
      .from(documents)
      .innerJoin(courses, eq(documents.courseId, courses.id))
      .where(eq(documents.id, parsedParams.data.documentId))
      .limit(1);
    if (!row) return reply.status(404).send({ error: 'Document not found.' });

    const rank = await getOrganizationRank(request, row.course.organizationId);
    const isMine = row.document.uploaderId === userId;
    if (rank < CAMPUS_ROLE_RANK.member || (row.document.status !== 'approved' && !isMine && rank < CAMPUS_ROLE_RANK.moderator)) {
      return reply.status(403).send({ error: 'Forbidden', message: 'This document is not available to you.' });
    }

    const url = await presignDownload(row.document.storageKey, row.document.fileName);
    await db
      .update(documents)
      .set({ downloads: sql`${documents.downloads} + 1` })
      .where(eq(documents.id, row.document.id));

    return reply.status(200).send({
      url,
      expiresIn: config.storage.signedUrlTtlSeconds,
      fileName: row.document.fileName,
      sizeBytes: row.document.sizeBytes,
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while preparing the download.' });
  }
}

export async function handleModerateDocument(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsedParams = idParam.safeParse(request.params);
    if (!parsedParams.success) return reply.status(400).send({ error: 'Invalid document id.' });

    const parsed = moderateSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    const [row] = await db
      .select({ document: documents, course: courses })
      .from(documents)
      .innerJoin(courses, eq(documents.courseId, courses.id))
      .where(eq(documents.id, parsedParams.data.documentId))
      .limit(1);
    if (!row) return reply.status(404).send({ error: 'Document not found.' });

    const rank = await getOrganizationRank(request, row.course.organizationId);
    if (rank < CAMPUS_ROLE_RANK.moderator) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Moderators only.' });
    }

    const [updated] = await db
      .update(documents)
      .set({ status: parsed.data.status })
      .where(eq(documents.id, row.document.id))
      .returning();

    return reply.status(200).send({ message: 'Document status updated.', document: publicShape(updated, (request.user as { id: string }).id, rank) });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while updating the document.' });
  }
}

export async function handleDeleteDocument(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsedParams = idParam.safeParse(request.params);
    if (!parsedParams.success) return reply.status(400).send({ error: 'Invalid document id.' });

    const userId = (request.user as { id: string }).id;
    const [row] = await db
      .select({ document: documents, course: courses })
      .from(documents)
      .innerJoin(courses, eq(documents.courseId, courses.id))
      .where(eq(documents.id, parsedParams.data.documentId))
      .limit(1);
    if (!row) return reply.status(404).send({ error: 'Document not found.' });

    const rank = await getOrganizationRank(request, row.course.organizationId);
    if (row.document.uploaderId !== userId && rank < CAMPUS_ROLE_RANK.moderator) {
      return reply.status(403).send({ error: 'Forbidden', message: 'You can only remove your own uploads.' });
    }

    await db.delete(documents).where(eq(documents.id, row.document.id));
    // The row is gone either way; a stale object is a cleanup task, not a failure.
    await deleteObject(row.document.storageKey).catch(() => undefined);

    return reply.status(200).send({ message: 'Document removed.' });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while deleting the document.' });
  }
}
