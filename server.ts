import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import TelegramBot from 'node-telegram-bot-api';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize Telegram Bot if token is available
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (token) {
    const bot = new TelegramBot(token, { polling: true });
    console.log('[Telegram] Bot initialized successfully');

    bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text;

      if (!text) return;

      console.log(`[Telegram] Message received from ${chatId}: ${text}`);

      try {
        // Show typing status
        bot.sendChatAction(chatId, 'typing');

        // Call the AI (using the Pollinations API)
        const response = await fetch('https://text.pollinations.ai/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [
              { role: 'system', content: 'You are a helpful and intelligent AI assistant. Keep your responses concise for Telegram.' },
              { role: 'user', content: text }
            ],
            seed: Math.floor(Math.random() * 1000000)
          }),
        });

        if (!response.ok) throw new Error('AI API Error');
        const generatedText = await response.text();

        // Send response back to Telegram
        bot.sendMessage(chatId, generatedText, { parse_mode: 'Markdown' });
      } catch (error: any) {
        console.error('[Telegram] Pollinations Error:', error);
        bot.sendMessage(chatId, "Bhai, server mein thoda issue aa gaya hai. Please thodi der baad try karo.");
      }
    });

    bot.on('polling_error', (error) => {
      console.error('[Telegram] Polling error:', error.message);
    });
  } else {
    console.log('[Telegram] Skipping bot initialization: TELEGRAM_BOT_TOKEN not set.');
  }

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
