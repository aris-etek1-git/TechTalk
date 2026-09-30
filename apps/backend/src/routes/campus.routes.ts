import { FastifyInstance } from 'fastify';
import {
  handleGetCampus,
  handleGetMyCampuses,
  handleJoinCampus,
  handleLeaveCampus,
  handleListCampuses,
  handleListMembers,
  handleChangeMemberRole,
  handleRemoveMember,
  handleUpdateCampus,
  handleCreateCampus,
} from '../controllers/campus.controller.js';
import { handleCreateGroup, handleListCampusGroups } from '../controllers/group.controller.js';
import { handleCreateEvent, handleListCampusEvents } from '../controllers/event.controller.js';

export async function campusRoutes(fastify: FastifyInstance) {
  const writeRateLimit = { rateLimit: { max: 20, timeWindow: '1 minute' } };

  fastify.get('/', { preHandler: [fastify.authenticate] }, handleListCampuses);
  fastify.get('/mine', { preHandler: [fastify.authenticate] }, handleGetMyCampuses);
  fastify.post('/', { preHandler: [fastify.authenticate, fastify.requireAdmin] }, handleCreateCampus);

  fastify.get('/:campusId', { preHandler: [fastify.authenticate, fastify.requireCampusVisible] }, handleGetCampus);
  fastify.patch(
    '/:campusId',
    { preHandler: [fastify.authenticate, fastify.requireCampusRole('admin')], config: writeRateLimit },
    handleUpdateCampus,
  );

  // Joining is how a member of a private campus proves belonging, so it is the
  // one route on a campus that must stay reachable without membership.
  fastify.post(
    '/:campusId/join',
    { preHandler: [fastify.authenticate], config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    handleJoinCampus,
  );
  fastify.delete(
    '/:campusId/membership',
    { preHandler: [fastify.authenticate], config: writeRateLimit },
    handleLeaveCampus,
  );

  fastify.get('/:campusId/members', { preHandler: [fastify.authenticate, fastify.requireCampusRole('member')] }, handleListMembers);
  fastify.patch(
    '/:campusId/members/:userId',
    { preHandler: [fastify.authenticate, fastify.requireCampusRole('admin')], config: writeRateLimit },
    handleChangeMemberRole,
  );
  fastify.delete(
    '/:campusId/members/:userId',
    { preHandler: [fastify.authenticate, fastify.requireCampusRole('moderator')], config: writeRateLimit },
    handleRemoveMember,
  );

  // Campus life. Nesting these under :campusId is what makes the guard work: the
  // plugins read the campus id from the params before the controller runs.
  fastify.get(
    '/:campusId/groups',
    { preHandler: [fastify.authenticate, fastify.requireCampusVisible] },
    handleListCampusGroups,
  );
  fastify.post(
    '/:campusId/groups',
    { preHandler: [fastify.authenticate, fastify.requireCampusRole('member')], config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    handleCreateGroup,
  );
  fastify.get(
    '/:campusId/events',
    { preHandler: [fastify.authenticate, fastify.requireCampusVisible] },
    handleListCampusEvents,
  );
  fastify.post(
    '/:campusId/events',
    { preHandler: [fastify.authenticate, fastify.requireCampusRole('member')], config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    handleCreateEvent,
  );
}
