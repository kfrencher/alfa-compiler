#!/usr/bin/env node
import { createServer } from 'http';
import { parse } from 'url';
import { AlfaCompiler } from './compiler.js';

const compiler = await (async function () {
    const compiler = new AlfaCompiler();
    try {
        console.log('Initializing ALFA compiler...');
        await compiler.initialize();
        console.log('ALFA compiler ready!');
        return compiler;
    } catch (error) {
        console.error('Failed to initialize compiler:', error);
        process.exit(1);
    }
})();

async function compileFile(filename: string): Promise<string> {
    if (!filename.trim()) {
        console.log('Please provide a filename');
        return '';
    }

    try {
        console.log(`Compiling: ${filename}`);
        const result = await compiler.compile(filename.trim());

        if (result && result.length > 0) {
            console.log('Compilation successful!');
            console.log('Output:');
            result.forEach((output, index) => {
                console.log(`--- Result ${index + 1} ---`);
                console.log(output);
                console.log('--- End Result ---\n');
            });
            return result.join('\n');
        } else {
            console.log('Compilation completed with no output');
            return '';
        }
    } catch (error) {
        console.error('Compilation failed:', error instanceof Error ? error.message : String(error));
        throw error;
    }
}

// Simple web server
const server = createServer(async (req, res) => {
    const { pathname, query } = parse(req.url || '', true);
    
    if (pathname === '/compile' && req.method === 'GET') {
        const filename = query.filename as string;
        
        if (!filename) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'filename parameter required' }));
            return;
        }

        try {
            const result = await compileFile(filename);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, output: result }));
        } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
        }
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
