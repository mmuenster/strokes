import express from 'express';
import cors from 'cors';
import roundsRouter from './routes/rounds.js';
import holesRouter from './routes/holes.js';
import shotsRouter from './routes/shots.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/rounds', roundsRouter);
app.use('/api/rounds/:roundId/holes', holesRouter);
app.use('/api/holes/:holeId/shots', shotsRouter);

// Standalone hole and shot routes (no parent param needed for PUT/DELETE)
app.use('/api/holes', holesRouter);
app.use('/api/shots', shotsRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Strokes server running on http://127.0.0.1:${PORT}`);
});
