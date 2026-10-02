import { FastifyInstance, FastifyRequest } from 'fastify';
import {
  handleCompleteOnboarding,
  handleGetMyInterests,
  handleGetMyProfile,
  handleGetPublicProfile,
  handleReplaceMyInterests,
  handleUpdateMyPreferences,
  handleUpdateMyProfile,
} from '../controllers/user.controller.js';

// A public profile may be read anonymously, but `school_only` needs to know who
// is asking, so a valid token is used when present and ignored when not.
async function optionalAuth(request: FastifyRequest) {
  try {
    await request.jwtVerify();
  } catch {
    // Anonymous: request.user stays unset and the visibility rules treat it so.
  }
}

export async function userRoutes(fastify: FastifyInstance) {
  fastify.get('/me/profile', { preHandler: [fastify.authenticate] }, handleGetMyProfile);
  fastify.patch('/me/profile', { preHandler: [fastify.authenticate] }, handleUpdateMyProfile);

  fastify.get('/me/interests', { preHandler: [fastify.authenticate] }, handleGetMyInterests);
  fastify.put('/me/interests', { preHandler: [fastify.authenticate] }, handleReplaceMyInterests);

  fastify.patch('/me/preferences', { preHandler: [fastify.authenticate] }, handleUpdateMyPreferences);
  fastify.post('/me/onboarding', { preHandler: [fastify.authenticate] }, handleCompleteOnboarding);

  fastify.get('/:handle/profile', { preHandler: [optionalAuth] }, handleGetPublicProfile);
}
