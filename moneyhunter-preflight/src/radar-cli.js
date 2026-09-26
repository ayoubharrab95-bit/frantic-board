import { runRadar } from './radar.js';

const minReward = Number(process.argv[2] || 5);

try {
  const results = await runRadar({ minReward });
  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
