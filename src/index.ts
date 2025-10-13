#!/usr/bin/env node
import { createServer } from 'http';
import { parse } from 'url';
import { IncomingMessage, ServerResponse } from 'http';
import { handleCompileRequest } from './request-compile.js';

// Simple web server
const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const { pathname, query } = parse(req.url || '', true);

  if (pathname === '/compile') {
    handleCompileRequest(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
