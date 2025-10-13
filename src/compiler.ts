import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { AlfaLanguageServerClient, LanguageServerConfig } from './language-server-client.js';

export class AlfaCompiler {
  private languageServerClient: AlfaLanguageServerClient;
  private enableDebug = true;
  private projectRoot = process.cwd();
  private languageServerPath = path.join(this.projectRoot, 'server', 'alfa-language-server.jar');

  constructor() {
    this.languageServerClient = new AlfaLanguageServerClient(this.getLanguageServerConfig());
  }

  /**
   * Compile an ALFA policy file
   */
  async compile(inputFile: string): Promise<string[]> {
    console.log(`Compiling ALFA file: ${inputFile}`);

    const stats = await fs.stat(inputFile);
    if (!stats.isFile()) {
      throw new Error(`Input path is not a file: ${inputFile}`);
    }

    if (!fsSync.existsSync(inputFile)) {
      throw new Error(`Input file not found: ${inputFile}`);
    }

    return this.languageServerClient.compile(inputFile);
  }

  /**
   * Initialize the language server (if configured)
   */
  async initialize(): Promise<void> {
    if (this.languageServerClient && !this.languageServerClient.isReady()) {
      await this.languageServerClient.initialize();
    }
  }

  /**
   * Shutdown and cleanup resources
   */
  async shutdown(): Promise<void> {
    if (this.languageServerClient) {
      await this.languageServerClient.stop();
    }
  }

  /**
   * Check if language server is ready
   */
  isLanguageServerReady(): boolean {
    return this.languageServerClient?.isReady() || false;
  }

  /**
   * Get default ALFA language server configuration
   */
  private getLanguageServerConfig(): LanguageServerConfig {
    const serverPath = this.languageServerPath;
    if (!fsSync.existsSync(serverPath)) {
      throw new Error(`ALFA language server jar not found at: ${serverPath}`);
    }

    const javaPath = 'java';

    const args = ['-jar', serverPath];
    if (this.enableDebug) {
      args.push('-trace');
      args.push('-log');
    }

    return {
      command: javaPath,
      args: args,
      cwd: this.projectRoot,
    };
  }
}

export const compiler = await (async function () {
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

export async function compileFile(filename: string): Promise<string> {
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
