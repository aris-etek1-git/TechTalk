import { FastifyInstance } from 'fastify';
import {
  handleDeleteEvent,
  handleDeleteRsvp,
  handleGetEvent,
  handleListMyEvents,
  handleRsvpEvent,
  handleUpdateEvent,
} from '../controllers/event.controller.js';

export async function eventRoutes(fastify: FastifyInstance) {
  const writeRateLimit = { rateLimit: { max: 20, timeWindow: '1 minute' } };

  fastify.get('/mine', { preHandler: [fastify.authenticate] }, handleListMyEvents);

  fastify.get('/:eventId', { preHandler: [fastify.authenticate] }, handleGetEvent);
  // Cancelling is a PATCH with status='cancelled': the row and its RSVPs survive.
  fastify.patch('/:eventId', { preHandler: [fastify.authenticate], config: writeRateLimit }, handleUpdateEvent);
  fastify.delete('/:eventId', { preHandler: [fastify.authenticate], config: writeRateLimit }, handleDeleteEvent);

  fastify.post('/:eventId/rsvp', { preHandler: [fastify.authenticate], config: writeRateLimit }, handleRsvpEvent);
  fastify.delete('/:eventId/rsvp', { preHandler: [fastify.authenticate], config: writeRateLimit }, handleDeleteRsvp);
}
