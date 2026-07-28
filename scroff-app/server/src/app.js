import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { ensureSession } from './lib/session.js';
import { authRouter } from './routes/auth.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { gameRouter } from './routes/game.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  // Only needed when the client dev-server runs on a different origin/port
  // than this API (i.e. local development). In production the built client
  // is served by this same process, so no cross-origin requests happen.
  if (process.env.CORS_ORIGIN) {
    app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
  }

  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/game', ensureSession, gameRouter);

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Something went wrong' });
  });

  // Serve the built client (client/dist) in production so the whole app is
  // a single deployable process. `npm run build` in /client produces this.
  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'), (err) => {
      if (err) next();
    });
  });

  return app;
}
