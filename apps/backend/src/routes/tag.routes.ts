import { FastifyInstance } from 'fastify';
import { handleBackfillTags, handleGetTagContents, handleListTags } from '../controllers/tag.controller.js';

export async function tagRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [fastify.authenticate] }, handleListTags);
  fastify.get('/:slug/contents', { preHandler: [fastify.authenticate] }, handleGetTagContents);
  fastify.post('/backfill', { preHandler: [fastify.authenticate, fastify.requireAdmin] }, handleBackfillTags);
}
