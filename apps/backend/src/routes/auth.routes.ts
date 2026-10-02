import { FastifyInstance } from 'fastify';
import { handleRegister, handleLogin, handleGoogleAuth, handleGithubStart, handleGithubCallback, handleUpdateProfile, handleGetMe, handleRefresh } from '../controllers/auth.controller.js';

export async function authRoutes(fastify: FastifyInstance) {
  const authRateLimit = { rateLimit: { max: 20, timeWindow: '1 minute' } };

  fastify.post('/register', { config: authRateLimit }, handleRegister);

  fastify.post('/login', { config: authRateLimit }, handleLogin);

  fastify.post('/google', { config: authRateLimit }, handleGoogleAuth);

  // GitHub OAuth: the browser navigates here, then GitHub returns to the callback.
  fastify.get('/github', handleGithubStart);
  fastify.get('/github/callback', handleGithubCallback);

  fastify.post('/refresh', { config: authRateLimit }, handleRefresh);

  fastify.patch('/profile', { preHandler: [fastify.authenticate] }, handleUpdateProfile);

  fastify.get('/me', { preHandler: [fastify.authenticate] }, handleGetMe);
}
