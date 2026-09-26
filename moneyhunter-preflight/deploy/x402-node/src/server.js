import { createApp } from './app.js';

const port = Number(process.env.PORT || 10000);
const app = createApp();

app.listen(port, () => {
  console.error(`MoneyHunter x402 Express gateway listening on port ${port}`);
});
