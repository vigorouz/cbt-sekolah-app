import path from 'path';
import express, { Request, Response } from 'express';
import app from './api/index';
import { seedDemoData } from './src/db/queries';

const PORT = 3000;

// --- VITE MIDDLEWARE / STATIC SERVING & STANDALONE LISTENER ---
// Only launch the local/container listener when not running in Vercel Serverless environment
if (!process.env.VERCEL) {
  async function startStandaloneServer() {
    try {
      const { getPool } = await import('./src/db/index');
      const pool = getPool();
      await pool.query(`
        ALTER TABLE questions ALTER COLUMN opsi_a DROP NOT NULL;
        ALTER TABLE questions ALTER COLUMN opsi_b DROP NOT NULL;
        ALTER TABLE questions ALTER COLUMN opsi_c DROP NOT NULL;
        ALTER TABLE questions ALTER COLUMN opsi_d DROP NOT NULL;
        ALTER TABLE questions ALTER COLUMN opsi_e DROP NOT NULL;
        ALTER TABLE questions ALTER COLUMN kunci DROP NOT NULL;
      `).catch(() => {});
      await seedDemoData();
      console.log('Database initialized / checked.');
    } catch (err) {
      console.warn('Initial seeding check notice:', err);
    }

    if (process.env.NODE_ENV !== 'production') {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`CBT Server running on http://localhost:${PORT}`);
    });
  }

  startStandaloneServer();
}

export default app;
