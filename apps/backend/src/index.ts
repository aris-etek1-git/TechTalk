import { config } from './config/env.js';
import { createApp } from './app.js';
import { initAutomationWorkers } from './services/automation/index.js';

const start = async () => {
  try {
    const fastify = await createApp();
    await fastify.ready();
    await fastify.listen({ port: config.port, host: '0.0.0.0' });

    console.log('\n===============================================');
    console.log(' TechTalk Multimedia Backend is now LIVE!');
    console.log(`Server running on: http://localhost:${config.port}`);
    console.log('===============================================\n');

    initAutomationWorkers();

  } catch (err) {
    console.error(' Error during startup:', err);
    process.exit(1);
  }
};

start();
