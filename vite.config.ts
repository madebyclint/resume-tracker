import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Custom plugin to handle extension API
const extensionApiPlugin = () => {
  return {
    name: 'extension-api',
    configureServer(server) {
      server.middlewares.use('/api/job-description', (req, res, next) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          req.on('end', () => {
            try {
              const jobData = JSON.parse(body);
              console.log('📨 Extension job data received:', jobData);
              
              // Broadcast to all connected clients
              server.ws.send('extension-job-data', jobData);
              
              res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST',
                'Access-Control-Allow-Headers': 'Content-Type'
              });
              res.end(JSON.stringify({ 
                success: true, 
                message: 'Job data received successfully' 
              }));
            } catch (error) {
              console.error('Error parsing job data:', error);
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid JSON data' }));
            }
          });
        } else if (req.method === 'OPTIONS') {
          res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control'
          });
          res.end();
        } else {
          next();
        }
      });
    }
  };
};

export default defineConfig({
  plugins: [react(), extensionApiPlugin()],
  server: {
    cors: true,
    port: 5173,
  }
});
