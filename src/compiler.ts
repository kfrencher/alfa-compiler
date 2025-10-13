import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { AlfaLanguageServerClient, CompilationResult, LanguageServerConfig } from './language-server-client.js';

export class AlfaCompiler {
  private languageServerClient: AlfaLanguageServerClient;
  private enableDebug = true;

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

    // Always use language server for compilation - no fallback
    await this.clearCompilationOutputDir();
    if (!this.languageServerClient.isReady()) {
      throw new Error('Language server is not initialized. Please call initialize() before compiling.');
    }

    await this.languageServerClient.didChangeWatchedFiles(inputFile);

    // TODO: Improve this with a more robust mechanism to ensure the server has processed the file change
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait a moment for the server to process the change

    const compiledResult = await this.languageServerClient.getCompilationOutput();
    
    console.log('Compiled result:');
    console.log(compiledResult);
    return compiledResult
  }

  /**
   * Initialize the language server (if configured)
   */
  async initialize(): Promise<void> {
    await this.clearCompilationOutputDir();
    if (this.languageServerClient && !this.languageServerClient.isReady()) {
      await this.languageServerClient.start();
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
    const projectRoot = process.cwd();
    const serverPath = path.join(projectRoot, 'server', 'alfa-language-server.jar');
    
    if (!fsSync.existsSync(serverPath)) {
      throw new Error(`ALFA language server jar not found at: ${serverPath}`);
    }

    const javaPath = 'java';

    const args = ['-jar', serverPath];
    if(this.enableDebug) {
      args.push('-trace');
      args.push('-log');
    }
    
    return {
      command: javaPath,
      args: args,
      cwd: projectRoot
    };
  }

  /**
   * Clear the compilation output directory. This is the
   * directory where the language server writes compiled files.
   */
  private async clearCompilationOutputDir(): Promise<void> {
    const outputDir = path.join(process.cwd(), 'src-gen');
    // Delete old output files to avoid confusion
    try {
      const oldFiles = await fs.readdir(outputDir);
      for (const file of oldFiles) {
        const filePath = path.join(outputDir, file);
        await fs.unlink(filePath);
      }
    } catch (deleteError) {
      throw new Error(`Failed to clean old output files: ${deleteError instanceof Error ? deleteError.message : String(deleteError)}`);
    }

  }
}