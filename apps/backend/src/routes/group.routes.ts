import { FastifyInstance } from 'fastify';
import {
  handleDeleteGroup,
  handleGetGroup,
  handleJoinGroup,
  handleLeaveGroup,
  handleListGroupMembers,
  handleListMyGroups,
  handleUpdateGroup,
} from '../controllers/group.controller.js';

export async function groupRoutes(fastify: FastifyInstance) {
  const writeRateLimit = { rateLimit: { max: 20, timeWindow: '1 minute' } };
  const joinRateLimit = { rateLimit: { max: 10, timeWindow: '1 minute' } };

  // Registered before the item routes: '/mine' would otherwise be swallowed by
  // ':groupId', and the controller would answer 400 on an invalid UUID.
  fastify.get('/mine', { preHandler: [fastify.authenticate] }, handleListMyGroups);

  fastify.get('/:groupId', { preHandler: [fastify.authenticate] }, handleGetGroup);
  fastify.patch('/:groupId', { preHandler: [fastify.authenticate], config: writeRateLimit }, handleUpdateGroup);
  fastify.delete('/:groupId', { preHandler: [fastify.authenticate], config: writeRateLimit }, handleDeleteGroup);

  fastify.post('/:groupId/join', { preHandler: [fastify.authenticate], config: joinRateLimit }, handleJoinGroup);
  fastify.delete('/:groupId/membership', { preHandler: [fastify.authenticate], config: writeRateLimit }, handleLeaveGroup);
  fastify.get('/:groupId/members', { preHandler: [fastify.authenticate] }, handleListGroupMembers);
}
