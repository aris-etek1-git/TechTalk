import Fastify, { type FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import type { preHandlerHookHandler } from 'fastify';
import { config } from './config/env.js';
import { authRoutes } from './routes/auth.routes.js';
import { contentRoutes } from './routes/content.routes.js';
import { campusRoutes } from './routes/campus.routes.js';
import { organizationRoutes } from './routes/organization.routes.js';
import { courseRoutes } from './routes/course.routes.js';
import { documentRoutes } from './routes/document.routes.js';
import { groupRoutes } from './routes/group.routes.js';
import { eventRoutes } from './routes/event.routes.js';
import { tagRoutes } from './routes/tag.routes.js';
import { projectRoutes } from './routes/project.routes.js';
import { searchRoutes } from './routes/search.routes.js';
import { userRoutes } from './routes/user.routes.js';
import { interactionRoutes } from './routes/interaction.routes.js';
import { feedRoutes } from './routes/feed.routes.js';
import { requireCampusRole, requireCampusVisible } from './plugins/campus-access.js';
import type { CampusRole } from './plugins/campus-access.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
    requireAdmin: (request: any, reply: any) => Promise<void>;
    requireCampusRole: (role: CampusRole) => preHandlerHookHandler;
    requireCampusVisible: preHandlerHookHandler;
  }
}

export async function createApp(): Promise<FastifyInstance> {
  const fastify = Fastify({ logger: config.nodeEnv !== 'test' });

  fastify.register(cors, { origin: config.corsOrigin });
  fastify.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  fastify.register(jwt, { secret: config.jwtSecret });
  fastify.register(multipart, {
    // One file per request, capped before it is buffered in memory.
    limits: { fileSize: config.storage.maxUploadBytes, files: 1 },
  });

  fastify.addHook('onSend', async (_request, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    return payload;
  });

  fastify.decorate('authenticate', async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or missing token.' });
    }
  });

  fastify.decorate('requireAdmin', async (request: any, reply: any) => {
    if (!request.user || request.user.role !== 'admin') {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Access denied. Only administrators can perform this action.',
      });
    }
  });

  fastify.decorate('requireCampusRole', requireCampusRole);
  fastify.decorate('requireCampusVisible', requireCampusVisible);

  fastify.register(authRoutes, { prefix: '/api/auth' });
  fastify.register(contentRoutes, { prefix: '/api/content' });
  fastify.register(campusRoutes, { prefix: '/api/campuses' });
  fastify.register(organizationRoutes, { prefix: '/api/organizations' });
  fastify.register(courseRoutes, { prefix: '/api/courses' });
  fastify.register(documentRoutes, { prefix: '/api/documents' });
  fastify.register(groupRoutes, { prefix: '/api/groups' });
  fastify.register(eventRoutes, { prefix: '/api/events' });
  fastify.register(tagRoutes, { prefix: '/api/tags' });
  fastify.register(projectRoutes, { prefix: '/api/projects' });
  fastify.register(userRoutes, { prefix: '/api/users' });
  fastify.register(interactionRoutes, { prefix: '/api/interactions' });
  fastify.register(feedRoutes, { prefix: '/api/feed' });
  fastify.register(searchRoutes, { prefix: '/api/search' });

  fastify.get('/api/health', async () => {
    return { status: 'OK', message: 'TechTalk API is running smoothly' };
  });

  return fastify;
}
