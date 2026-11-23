import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import { attachLiveWebSocketServer } from './live/liveRouter.js';
import { apiRouter } from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3188);
const app = express();

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use('/api', apiRouter);

// Serve built frontend in production
const candidateDistDirs = [
  path.resolve(__dirname, '..', 'dist'),
  path.resolve(__dirname, '..', '..', 'dist'),
];
const distDir = candidateDistDirs.find((dir) => fs.existsSync(path.join(dir, 'index.html')));

const isProduction = process.env.NODE_ENV === 'production' || process.argv.includes('--prod');
if (distDir && isProduction) {
  app.use(express.static(distDir));
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

const server = http.createServer(app);
attachLiveWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`[RoastPal] API & WebSocket server listening on http://localhost:${PORT}`);
});
