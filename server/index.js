import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';
import roundsRouter from './routes/rounds.js';
import holesRouter from './routes/holes.js';
import shotsRouter from './routes/shots.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

if (!isProd) {
  app.use(cors({ origin: 'http://localhost:5173' }));
}
app.use(express.json());

app.use('/api/rounds', roundsRouter);
app.use('/api/rounds/:roundId/holes', holesRouter);
app.use('/api/holes/:holeId/shots', shotsRouter);

// Standalone hole and shot routes (no parent param needed for PUT/DELETE)
app.use('/api/holes', holesRouter);
app.use('/api/shots', shotsRouter);

if (isProd) {
  const clientDist = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const host = isProd ? '0.0.0.0' : '127.0.0.1';
app.listen(PORT, host, () => {
  console.log(`Strokes server running on http://${host}:${PORT}`);
});
