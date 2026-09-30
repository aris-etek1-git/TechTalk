import { FastifyInstance } from 'fastify';
import {
  handleDeleteDocument,
  handleDownloadDocument,
  handleModerateDocument,
} from '../controllers/document.controller.js';

export async function documentRoutes(fastify: FastifyInstance) {
  fastify.get('/:documentId/download', {
    preHandler: [fastify.authenticate],
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, handleDownloadDocument);

  fastify.patch('/:documentId/status', {
    preHandler: [fastify.authenticate],
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  }, handleModerateDocument);

  fastify.delete('/:documentId', {
    preHandler: [fastify.authenticate],
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  }, handleDeleteDocument);
}
