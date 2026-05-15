import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { setupTelegramBot } from './src/bot/main.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize modular Telegram Bot
  setupTelegramBot();

  // API routes FIRST
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Self-ping logic to keep the instance "warm"
    // Note: Best used with external ping services like UptimeRobot
    const APP_URL = process.env.APP_URL;
    if (APP_URL) {
      console.log(`[Keep-Alive] Monitoring enabled for ${APP_URL}`);
      setInterval(async () => {
        try {
          const response = await fetch(`${APP_URL}/api/health`);
          if (response.ok) {
            console.log(`[Keep-Alive] Heartbeat success at ${new Date().toLocaleTimeString()}`);
          }
        } catch (error) {
          console.error('[Keep-Alive] Heartbeat failed:', error);
        }
      }, 5 * 60 * 1000); // Ping every 5 minutes
    } else {
      console.log('[Keep-Alive] APP_URL not set. Internal heartbeat disabled.');
    }
  });
}

startServer();
