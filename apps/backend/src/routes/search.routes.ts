import { FastifyInstance } from 'fastify';
import { handleGlobalSearch } from '../controllers/search.controller.js';

export async function searchRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [fastify.authenticate] }, handleGlobalSearch);
}
