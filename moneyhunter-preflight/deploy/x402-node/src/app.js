import { Hono } from 'hono';
import { paymentMiddleware } from '@x402/hono';
import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';

const isEvmAddress = (value) => /^0x[a-fA-F0-9]{40}$/.test(value || '');

export function createApp(config = {}) {
  const NETWORK = config.NETWORK || process.env.NETWORK || 'eip155:84532';
  const ORIGIN_URL =
    config.ORIGIN_URL ||
    process.env.ORIGIN_URL ||
    'https://moneyhunter-preflight.onrender.com';
  const PAY_TO = config.PAY_TO || process.env.PAY_TO || '';
  const PRICE_PREFLIGHT =
    config.PRICE_PREFLIGHT || process.env.PRICE_PREFLIGHT || '$0.05';
  const PRICE_RADAR =
    config.PRICE_RADAR || process.env.PRICE_RADAR || '$0.10';
  const PRICE_PAYMENT_RELIABILITY =
    config.PRICE_PAYMENT_RELIABILITY ||
    process.env.PRICE_PAYMENT_RELIABILITY ||
    '$0.03';

  const app = new Hono();

  const facilitator = new HTTPFacilitatorClient({
    url: 'https://x402.org/facilitator'
  });

  const resourceServer = new x402ResourceServer(facilitator)
    .register('eip155:84532', new ExactEvmScheme())
    .register('eip155:8453', new ExactEvmScheme());

  function paidRoute(method, path, price, description) {
    return async (c, next) => {
      if (!isEvmAddress(PAY_TO)) {
        return c.json(
          {
            error: 'x402_not_configured',
            detail: 'PAY_TO must be a valid public EVM address.'
          },
          503
        );
      }

      return paymentMiddleware(
        {
          [`${method} ${path}`]: {
            accepts: {
              scheme: 'exact',
              price,
              network: NETWORK,
              payTo: PAY_TO
            },
            description
          }
        },
        resourceServer
      )(c, next);
    };
  }

  app.get('/', (c) =>
    c.json({
      name: 'MoneyHunter x402 Gateway',
      version: '0.2.0',
      network: NETWORK,
      origin: ORIGIN_URL,
      prices: {
        preflight: PRICE_PREFLIGHT,
        radar: PRICE_RADAR,
        payment_reliability: PRICE_PAYMENT_RELIABILITY
      },
      endpoints: {
        health: '/health',
        preflight: '/v1/preflight',
        radar: '/v1/radar',
        payment_reliability: '/v1/payment-reliability'
      }
    })
  );

  app.get('/health', (c) =>
    c.json({
      ok: true,
      service: 'moneyhunter-x402-gateway',
      network: NETWORK,
      origin: ORIGIN_URL,
      pay_to_configured: isEvmAddress(PAY_TO)
    })
  );

  app.use(
    '/v1/preflight',
    paidRoute(
      'POST',
      '/v1/preflight',
      PRICE_PREFLIGHT,
      'MoneyHunter bounty preflight'
    )
  );

  app.use(
    '/v1/radar',
    paidRoute(
      'GET',
      '/v1/radar',
      PRICE_RADAR,
      'MoneyHunter paid opportunity radar'
    )
  );

  app.use(
    '/v1/payment-reliability',
    paidRoute(
      'POST',
      '/v1/payment-reliability',
      PRICE_PAYMENT_RELIABILITY,
      'MoneyHunter payment reliability check'
    )
  );

  app.all('/v1/*', async (c) => {
    const url = new URL(c.req.url);
    const upstream = `${ORIGIN_URL}${url.pathname}${url.search}`;
    const headers = new Headers(c.req.raw.headers);

    headers.delete('host');
    headers.delete('payment-signature');
    headers.delete('payment-required');
    headers.delete('payment-response');

    const response = await fetch(upstream, {
      method: c.req.method,
      headers,
      body: ['GET', 'HEAD'].includes(c.req.method)
        ? undefined
        : c.req.raw.body,
      redirect: 'follow'
    });

    return new Response(response.body, {
      status: response.status,
      headers: response.headers
    });
  });

  return app;
}

export { isEvmAddress };
