import { serve } from '@hono/node-server';
import { createApp } from './app.js';

const port = Number(process.env.PORT || 10000);
const app = createApp();

serve({
  fetch: app.fetch,
  port
});

console.error(`MoneyHunter x402 gateway listening on port ${port}`);
