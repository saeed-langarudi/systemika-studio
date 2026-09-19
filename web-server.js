'use strict';

// Development/source-tree launcher for Systemika Studio.
//
// The WebApp must be served over HTTP(S) rather than opened through file://
// when it needs the File System Access API from OpenSystemDynamics' iframe.
// Serving the complete source tree from one localhost origin keeps the wrapper
// and editor same-origin and makes localhost a trustworthy browser context.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const root = path.resolve(__dirname);
const portArg = process.argv.slice(2).find((arg) => /^\d+$/.test(arg));
const requestedPort = Number(process.env.SYSTEMIKA_WEB_PORT || portArg || 8765);
const noOpen = process.argv.includes('--no-open') || process.env.SYSTEMIKA_WEB_NO_OPEN === '1';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function safePathFromUrl(urlString) {
  const rawPath = decodeURIComponent(new URL(urlString, 'http://localhost').pathname);
  const relative = rawPath === '/' ? 'start.html' : rawPath.replace(/^\/+/, '');
  const candidate = path.resolve(root, relative);
  if (candidate !== root && !candidate.startsWith(root + path.sep)) return null;
  return candidate;
}

function sendError(res, status, message) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(message);
}

const server = http.createServer((req, res) => {
  if (!req.url || (req.method !== 'GET' && req.method !== 'HEAD')) {
    sendError(res, 405, 'Method not allowed');
    return;
  }

  const filePath = safePathFromUrl(req.url);
  if (!filePath) {
    sendError(res, 403, 'Forbidden');
    return;
  }

  fs.stat(filePath, (statError, stat) => {
    if (statError || !stat.isFile()) {
      sendError(res, 404, 'Not found');
      return;
    }

    const contentType = mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      // Source-tree testing should always see current files after a rebuild/edit.
      'Cache-Control': 'no-store',
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(filePath).pipe(res);
  });
});

function openBrowser(url) {
  if (noOpen) return;
  let command;
  if (process.platform === 'win32') command = `start "" "${url}"`;
  else if (process.platform === 'darwin') command = `open "${url}"`;
  else command = `xdg-open "${url}"`;
  exec(command, (error) => {
    if (error) console.log(`Open this URL in a Chromium-based browser: ${url}`);
  });
}

function listen(port, attemptsLeft) {
  const onError = (error) => {
    server.removeListener('listening', onListening);
    if (error.code === 'EADDRINUSE' && attemptsLeft > 0) {
      setTimeout(() => listen(port + 1, attemptsLeft - 1), 25);
      return;
    }
    throw error;
  };
  const onListening = () => {
    server.removeListener('error', onError);
    const address = server.address();
    const actualPort = address && address.port ? address.port : port;
    const url = `http://localhost:${actualPort}/start.html`;
    console.log(`Systemika Studio is running at ${url}`);
    console.log('Keep this terminal window open while using the WebApp. Press Ctrl+C to stop.');
    openBrowser(url);
  };
  server.once('error', onError);
  server.once('listening', onListening);
  server.listen(port, '127.0.0.1');
}

listen(requestedPort, 20);
