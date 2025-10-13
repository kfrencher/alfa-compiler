import { compileFile } from './compiler.js';
import { IncomingMessage, ServerResponse } from 'http';
import { writeFile, mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const projectRoot = process.cwd();
const policiesDir = join(projectRoot, 'server', 'policies');

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

  let filePath: string | null = null;

  try {
    // Read the uploaded file content
    const fileContent = await readRequestBody(req);
    
    if (!fileContent.trim()) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Empty file content' }));
      return;
    }

    // Create a temporary file to save the uploaded content
    filePath = join(policiesDir, 'uploaded-policy.alfa');
    
    // Write the content to temporary file
    await writeFile(filePath, fileContent, 'utf-8');
    
    console.log(`Processing uploaded file: ${filePath}`);
    
    // Compile the temporary file
    const result = await compileFile(filePath);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, output: result }));

  } catch (error) {
    console.error('File upload compilation error:', error);
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: error instanceof Error ? error.message : String(error) 
    }));
  } finally {
    // Clean up temporary file
    if (filePath) {
      try {
        await rm(filePath, { force: true });
        console.log(`Cleaned up temporary file: ${filePath}`);
      } catch (cleanupError) {
        console.warn('Failed to clean up temporary files:', cleanupError);
      }
    }
  }
}

/**
 * Reads the request body and returns it as a string
 */
function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    
    req.on('data', (chunk) => {
      body += chunk.toString('utf-8');
    });
    
    req.on('end', () => {
      resolve(body);
    });
    
    req.on('error', (error) => {
      reject(error);
    });
  });
}