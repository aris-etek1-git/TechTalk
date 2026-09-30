import { FastifyInstance } from 'fastify';
import { handleCreateCourse, handleGetCourse, handleListCourses } from '../controllers/course.controller.js';
import { handleListDocuments, handleUploadDocument } from '../controllers/document.controller.js';

export async function courseRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [fastify.authenticate] }, handleListCourses);
  fastify.post('/', {
    preHandler: [fastify.authenticate],
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  }, handleCreateCourse);

  fastify.get('/:courseId', { preHandler: [fastify.authenticate] }, handleGetCourse);
  fastify.get('/:courseId/documents', { preHandler: [fastify.authenticate] }, handleListDocuments);

  // Uploads buffer the file in memory: a tight limit keeps one student from
  // saturating the process with concurrent 25 MB posts.
  fastify.post('/:courseId/documents', {
    preHandler: [fastify.authenticate],
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, handleUploadDocument);
}
