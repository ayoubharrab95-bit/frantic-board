import { createApp } from './app.js';

const port = Number(process.env.PORT || 10000);
const network = process.env.NETWORK || 'eip155:84532';
const facilitator = process.env.FACILITATOR_URL || 'https://facilitator.payai.network';
const payTo = process.env.PAY_TO || '';
const app = createApp();

app.listen(port, () => {
  const hint = /^0x[a-fA-F0-9]{40}$/.test(payTo)
    ? `${payTo.slice(0, 8)}…${payTo.slice(-6)}`
    : 'not-configured';
  console.error(
    `MoneyHunter x402 gateway live | port=${port} | network=${network} | production=${network === 'eip155:8453'} | payTo=${hint} | facilitator=${facilitator}`
  );
});
