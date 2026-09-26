import { Hono } from 'hono';
import { paymentMiddleware } from 'x402-hono';

type Bindings = {
  NETWORK: string;
  ORIGIN_URL: string;
  PAY_TO: string;
  PRICE_PREFLIGHT: string;
  PRICE_RADAR: string;
};

const app = new Hono<{ Bindings: Bindings }>();

function paywall(c: any, next: any, pattern: string, price: string, description: string) {
  return paymentMiddleware(
    c.env.PAY_TO,
    {
      [pattern]: {
        price,
        network: c.env.NETWORK,
        config: { description }
      }
    },
    { url: 'https://x402.org/facilitator' }
  )(c, next);
}

app.use('/v1/preflight', (c, next) =>
  paywall(c, next, '/v1/preflight', c.env.PRICE_PREFLIGHT, 'MoneyHunter bounty preflight')
);

app.use('/v1/radar', (c, next) =>
  paywall(c, next, '/v1/radar', c.env.PRICE_RADAR, 'MoneyHunter opportunity radar')
);

app.all('/v1/*', async (c) => {
  const url = new URL(c.req.url);
  const upstream = `${c.env.ORIGIN_URL}${url.pathname}${url.search}`;
  const headers = new Headers(c.req.raw.headers);
  headers.delete('host');

  return fetch(upstream, {
    method: c.req.method,
    headers,
    body: ['GET', 'HEAD'].includes(c.req.method) ? undefined : c.req.raw.body
  });
});

app.get('/health', (c) => c.json({
  ok: true,
  service: 'moneyhunter-x402-gateway',
  network: c.env.NETWORK
}));

export default app;
