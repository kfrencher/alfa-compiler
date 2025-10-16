import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { AlfaLanguageServerClient, LanguageServerConfig } from './language-server-client.js';
import { fileURLToPath } from 'url';
import { FileChangeType } from 'vscode-languageserver-protocol';
import { CompiledFile } from './language-server-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class AlfaCompiler {
  private languageServerClient: AlfaLanguageServerClient;
  private enableDebug = true;
  private packageRoot = path.resolve(__dirname, '..');
  private languageServerPath = path.join(this.packageRoot, 'server', 'alfa-language-server.jar');

  constructor() {
    this.languageServerClient = new AlfaLanguageServerClient(this.getLanguageServerConfig());
  }

  async compileFiles(files: string[]): Promise<CompiledFile[]> {
    if (!files || files.length === 0) {
      throw new Error('No files provided for compilation');
    }

    for (const inputFile of files) {
      const stats = await fs.stat(inputFile);
      if (!stats.isFile()) {
        throw new Error(`Input path is not a file: ${inputFile}`);
      }

      if (!fsSync.existsSync(inputFile)) {
        throw new Error(`Input file not found: ${inputFile}`);
      }
    }

    return this.languageServerClient.compileFiles(files);
  }

  /**
   * Compile an ALFA policy file
   */
  async compile(inputFile: string): Promise<CompiledFile[]> {
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
   * Allows clients to notify the language server that a file was deleted
   */
  async notifyDeletedFiles(filePaths: string[]): Promise<void> {
    this.languageServerClient.didChangeWatchedFiles(filePaths, FileChangeType.Deleted);
  }

  /**
   * Allows clients to notify the language server that a file was deleted
   */
  async notifyDeletedFile(filePath: string): Promise<void> {
    this.languageServerClient.didChangeWatchedFiles(filePath, FileChangeType.Deleted);
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
      cwd: this.packageRoot,
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

/**
 * Allows clients to notify the language server that a file was deleted
 */
export async function notifyDeletedFiles(filePaths: string[]): Promise<void> {
  return compiler.notifyDeletedFiles(filePaths);
}

/**
 * Allows clients to notify the language server that a file was deleted
 */
export async function notifyDeletedFile(filePath: string): Promise<void> {
  return compiler.notifyDeletedFile(filePath);
}

/**
 * Use the AlfaCompiler instance to compile a file and return the output
 */
export async function compileFile(filename: string): Promise<CompiledFile[]> {
  return compileFiles([filename]);
}
/**
 * Use the AlfaCompiler instance to compile files and return the output
 */
export async function compileFiles(filenames: string[]): Promise<CompiledFile[]> {
  if (!filenames || filenames.length === 0) {
    throw new Error('Please provide at least one filename');
  }

  for (const filename of filenames) {
    if (!filename.trim()) {
      throw new Error('Please provide a filename');
    }
  }

  try {
    console.log(`Compiling: ${filenames.join(', ')}`);

    let result: CompiledFile[] = [];

    if (filenames.length === 1) {
      const fileName = filenames[0];
      if (!fileName) throw new Error('Filename is empty');
      result = await compiler.compile(fileName);
    } else {
      result = await compiler.compileFiles(filenames);
    }

    if (result && result.length > 0) {
      console.debug('Compilation successful!');
      console.debug('Output:');
      result.forEach((output, index) => {
        console.debug(`--- Result ${index + 1} ---`);
        console.debug(output);
        console.debug('--- End Result ---\n');
      });
      return result;
    } else {
      console.error('Compilation completed with no output');
      return [];
    }
  } catch (error) {
    console.error('Compilation failed:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}
