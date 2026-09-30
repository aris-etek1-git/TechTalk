import { FastifyInstance } from 'fastify';
import { handleCreateOrganization, handleListOrganizations } from '../controllers/campus.controller.js';

export async function organizationRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [fastify.authenticate] }, handleListOrganizations);

  // Schools are curated data, not self-service: an unverified organization would
  // instantly make the private-campus email-domain rule bypassable.
  fastify.post('/', {
    preHandler: [fastify.authenticate, fastify.requireAdmin],
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, handleCreateOrganization);
}
