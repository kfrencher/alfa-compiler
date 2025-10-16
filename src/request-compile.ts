import { createWriteStream } from 'fs';
import { rm, stat } from 'fs/promises';
import { IncomingMessage, ServerResponse } from 'http';
import { dirname, join, resolve } from 'path';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';
import { compileFile, notifyDeletedFile } from './compiler.js';
import { createLogger } from './logger.js';

const logger = createLogger('request-compile.ts');
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = resolve(__dirname, '..');
const policiesDir = join(packageRoot, 'server', 'policies');

/**
 * Handles an upload of a alfa file and returns the compiled XACML output
 */
export async function handleCompileRequest(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method Not Allowed. Use POST.' }));
    return;
  }

  const contentType = req.headers['content-type'] || '';
  
  if (!contentType.startsWith('text/plain')) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Content-Type must be text/plain' }));
    return;
  }

  // Check Content-Length header first
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength === 0) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Empty file content' }));
    return;
  }

  let filePath: string | null = null;

  try {
    // Create a temporary file to save the uploaded content
    filePath = join(policiesDir, `uploaded-policy-${Date.now()}.alfa`);
    
    // Pipe the request directly to file
    const writeStream = createWriteStream(filePath);
    await pipeline(req, writeStream);
    
    // Check if file is empty after writing
    const fileStats = await stat(filePath);
    if (fileStats.size === 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Empty file content' }));
      return;
    }
    
    logger.info(`Processing uploaded file: ${filePath} (${fileStats.size} bytes)`);
    
    // Compile the temporary file
    const result = await compileFile(filePath);
    if(result.length === 0) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Compilation produced no output' }));
      return;
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, output: result }));

  } catch (error) {
    logger.error('File upload compilation error:', error);
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: error instanceof Error ? error.message : String(error) 
    }));
  } finally {
    // Clean up temporary file
    if (filePath) {
      try {
        await rm(filePath, { force: true });
        await notifyDeletedFile(filePath);
        logger.info(`Cleaned up temporary file: ${filePath}`);
      } catch (cleanupError) {
        logger.warn('Failed to clean up temporary files:', cleanupError);
      }
    }
  }
}