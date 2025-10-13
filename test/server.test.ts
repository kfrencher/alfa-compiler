import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { readFile } from 'fs/promises';
import path from 'path';

describe('HTTP Server', () => {
  let serverProcess: ChildProcess;
  const baseUrl = 'http://localhost:3000';
  const policyDir = path.join(__dirname, 'resources', 'policies');

  beforeAll(async () => {
    // Then start the server directly
    console.log('Starting server...');
    serverProcess = spawn('node', ['dist/index.js'], {
      stdio: 'pipe',
    });

    // Wait for server to start
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server startup timeout'));
      }, 15000);

      serverProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Server running on')) {
          console.log('Server started successfully');
          clearTimeout(timeout);
          resolve(undefined);
        }
      });

      serverProcess.stderr?.on('data', (data) => {
        clearTimeout(timeout);
        reject(new Error(`Server error: ${data.toString()}`));
      });
    });
  }, 10000);

  afterAll(async () => {
    // Stop the server
    if (serverProcess) {
      console.log('Stopping server...');
      serverProcess.kill('SIGTERM');

      // Wait for "server closed" message or process exit
      await new Promise((resolve) => {
        serverProcess.on('exit', () => {
          console.log('Server process exited');
          resolve(undefined);
        });

        setTimeout(() => {
          console.error('Server did not shut down gracefully, killed forcefully');
          serverProcess.kill('SIGKILL');
          resolve(undefined);
        }, 5000);
      });
    }
  }, 10000);

  test('should return 404 for unknown endpoints', async () => {
    const response = await fetch(`${baseUrl}/unknown`);
    expect(response.status).toBe(404);

    const text = await response.text();
    expect(text).toBe('Not found');
  });

  test('should reject non-POST requests on /compile', async () => {
    const response = await fetch(`${baseUrl}/compile`, {
      method: 'GET',
    });

    expect(response.status).toBe(405);

    const json = await response.json();
    expect(json.error).toBe('Method Not Allowed. Use POST.');
  });

  test('should reject requests without text/plain content type', async () => {
    const response = await fetch(`${baseUrl}/compile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ test: 'data' }),
    });

    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json.error).toBe('Content-Type must be text/plain');
  });

  test('should reject empty file content', async () => {
    const response = await fetch(`${baseUrl}/compile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: '',
    });

    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json.error).toBe('Empty file content');
  });

  test('should compile valid ALFA content', async () => {
    const alfaContent = await readFile(path.join(policyDir, 'valid-policy.alfa.txt'), 'utf-8');

    const response = await fetch(`${baseUrl}/compile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: alfaContent,
    });

    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.output).toBeDefined();

    const output = json.output;
    expect(output).toContain('xacml3:Policy');
    expect(output).toContain('xacml3:Target');
    expect(output).toContain('xacml3:Rule');
    expect(output).toContain('http://axiomatics.com/alfa/identifier/testTxt.validPolicy');
  });
});
