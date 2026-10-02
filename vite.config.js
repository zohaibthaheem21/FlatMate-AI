import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';
import path from 'path';
import dns from 'dns';

try {
  if (dns && typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
  }
} catch {
  // Ignore fallback errors
}

dotenv.config();

function vercelApiDevPlugin() {
  return {
    name: 'vercel-api-dev-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api')) {
          return next();
        }

        try {
          const host = req.headers.host || 'localhost:3000';
          const urlObj = new URL(req.url, `http://${host}`);
          let routePath = urlObj.pathname.replace(/^\/api/, '');
          
          if (!routePath || routePath === '/') {
            routePath = '/init-db';
          }

          // Parse JSON request body if present
          if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
            const buffers = [];
            for await (const chunk of req) {
              buffers.push(chunk);
            }
            const bodyRaw = Buffer.concat(buffers).toString();
            try {
              req.body = bodyRaw ? JSON.parse(bodyRaw) : {};
            } catch {
              req.body = {};
            }
          } else {
            req.body = req.body || {};
          }

          // Parse query params
          req.query = Object.fromEntries(urlObj.searchParams.entries());

          // Add status and json response helpers to res
          res.status = function(code) {
            res.statusCode = code;
            return res;
          };
          res.json = function(data) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
            return res;
          };

          // Load serverless function module dynamically
          const apiModulePath = `/api${routePath}.js`;
          const handlerModule = await server.ssrLoadModule(apiModulePath);
          const handler = handlerModule.default;

          if (typeof handler === 'function') {
            await handler(req, res);
          } else {
            res.status(404).json({ error: `API handler at ${apiModulePath} not found.` });
          }
        } catch (err) {
          console.error('API Dev Middleware Error:', err);
          res.status(500).json({ error: err.message || 'Internal Server Error' });
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), vercelApiDevPlugin()],
  server: {
    port: 3000,
    open: true,
  },
});
