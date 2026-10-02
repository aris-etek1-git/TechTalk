import { FastifyInstance } from 'fastify';
import { handleGetFeed } from '../controllers/feed.controller.js';

export async function feedRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [fastify.authenticate] }, handleGetFeed);
}
