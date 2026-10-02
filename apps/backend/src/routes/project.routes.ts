import { FastifyInstance } from 'fastify';
import { handleListPublicProjects } from '../controllers/project.controller.js';

export async function projectRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [fastify.authenticate] }, handleListPublicProjects);
}
