import { Hono } from 'hono';
import { paymentMiddleware } from '@x402/hono';
import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';

type Bindings = {
  NETWORK: 'eip155:84532' | 'eip155:8453';
  ORIGIN_URL: string;
  PAY_TO: `0x${string}`;
  PRICE_PREFLIGHT: string;
  PRICE_RADAR: string;
  PRICE_PAYMENT_RELIABILITY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

const facilitator = new HTTPFacilitatorClient({
  url: 'https://x402.org/facilitator'
});

const resourceServer = new x402ResourceServer(facilitator)
  .register('eip155:84532', new ExactEvmScheme())
  .register('eip155:8453', new ExactEvmScheme());

function paidRoute(
  c: any,
  next: any,
  method: 'GET' | 'POST',
  path: string,
  price: string,
  description: string
) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(c.env.PAY_TO || '')) {
    return c.json(
      { error: 'x402_not_configured', detail: 'PAY_TO must be a valid public EVM address.' },
      503
    );
  }

  return paymentMiddleware(
    {
      [`${method} ${path}`]: {
        accepts: {
          scheme: 'exact',
          price,
          network: c.env.NETWORK,
          payTo: c.env.PAY_TO
        },
        description
      }
    },
    resourceServer
  )(c, next);
}

app.use('/v1/preflight', (c, next) =>
  paidRoute(c, next, 'POST', '/v1/preflight', c.env.PRICE_PREFLIGHT, 'MoneyHunter bounty preflight')
);

app.use('/v1/radar', (c, next) =>
  paidRoute(c, next, 'GET', '/v1/radar', c.env.PRICE_RADAR, 'MoneyHunter paid opportunity radar')
);

app.use('/v1/payment-reliability', (c, next) =>
  paidRoute(
    c,
    next,
    'POST',
    '/v1/payment-reliability',
    c.env.PRICE_PAYMENT_RELIABILITY,
    'MoneyHunter payment reliability check'
  )
);

app.all('/v1/*', async (c) => {
  const url = new URL(c.req.url);
  const upstream = `${c.env.ORIGIN_URL}${url.pathname}${url.search}`;
  const headers = new Headers(c.req.raw.headers);
  headers.delete('host');
  headers.delete('payment-signature');
  headers.delete('payment-required');
  headers.delete('payment-response');

  return fetch(upstream, {
    method: c.req.method,
    headers,
    body: ['GET', 'HEAD'].includes(c.req.method) ? undefined : c.req.raw.body
  });
});

app.get('/health', (c) =>
  c.json({
    ok: true,
    service: 'moneyhunter-x402-gateway',
    network: c.env.NETWORK,
    origin: c.env.ORIGIN_URL,
    pay_to_configured: /^0x[a-fA-F0-9]{40}$/.test(c.env.PAY_TO || '')
  })
);

export default app;
