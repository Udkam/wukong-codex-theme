import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

// Independent source exports can reuse dependencies through a Windows junction.
// Keep optimizer writes in the source export, away from the shared dependency tree.
const cacheDir = path.resolve('.wukong-runtime/studio-e2e-vite-cache');
fs.mkdirSync(cacheDir, { recursive: true });
const server = await createServer({ cacheDir, server: { host: '127.0.0.1', port: 5192, strictPort: true } });
await server.listen();
process.env.STUDIO_URL = 'http://127.0.0.1:5192/studio/';
try {
  await import('./studio.e2e.mjs');
} finally {
  await server.close();
}