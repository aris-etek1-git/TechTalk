import { FastifyInstance } from 'fastify';
import {
  handleListMyInteractions,
  handleMyInteractionSummary,
  handleRecordInteractions,
} from '../controllers/interaction.controller.js';

export async function interactionRoutes(fastify: FastifyInstance) {
  fastify.post('/', { preHandler: [fastify.authenticate] }, handleRecordInteractions);
  fastify.get('/', { preHandler: [fastify.authenticate] }, handleListMyInteractions);
  fastify.get('/summary', { preHandler: [fastify.authenticate] }, handleMyInteractionSummary);
}
