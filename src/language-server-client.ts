import { ChildProcess, spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import {
  createMessageConnection,
  Logger,
  MessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
} from 'vscode-jsonrpc/node.js';
import {
  ClientCapabilities,
  Diagnostic,
  InitializeParams,
  InitializeResult,
  PublishDiagnosticsParams,
} from 'vscode-languageserver-protocol';
import { URI } from 'vscode-uri';
import { FileChangeType } from 'vscode-languageserver-protocol';
import { fileURLToPath } from 'url';

export interface LanguageServerConfig {
  command: string;
  cwd: string;
  args: string[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class AlfaLanguageServerClient {
  private connection: MessageConnection;
  private serverProcess: ChildProcess | null = null;
  private isInitialized = false;
  private diagnostics: Map<string, Diagnostic[]> = new Map();
  private outputDir = path.join(path.resolve(__dirname,'..'), 'src-gen');

  constructor(private config: LanguageServerConfig) {
    // Start the language server process
    console.log(
      `Starting language server with command: ${this.config.command} ${this.config.args.join(' ')}`
    );
    this.serverProcess = spawn(this.config.command, this.config.args);

    if (!this.serverProcess.stdout || !this.serverProcess.stdin) {
      throw new Error('Failed to create language server process streams');
    }

    // Create message connection
    const reader = new StreamMessageReader(this.serverProcess.stdout);
    const writer = new StreamMessageWriter(this.serverProcess.stdin);

    this.connection = createMessageConnection(reader, writer, {
      error: (message: string) => console.error('LSP Error:', message),
      warn: (message: string) => console.warn('LSP Warning:', message),
      info: (message: string) => console.log('LSP Info:', message),
      log: (message: string) => console.log('LSP Log:', message),
    } as Logger);

    // Set up event handlers
    this.setupEventHandlers();

    // Start listening
    this.connection.listen();
  }

  /**
   * Initialize the language server
   */
  async initialize(): Promise<InitializeResult> {
    if (this.isInitialized) {
      throw new Error('Language server is already initialized');
    }

    console.log('Initializing language server...');

    const initParams: InitializeParams = {
      processId: process.pid,
      capabilities: this.getClientCapabilities(),
      rootUri: null, // This is unused. Use workspaceFolders instead.
      workspaceFolders: [
        {
          uri: URI.file(`${this.config.cwd}`).toString(),
          name: 'workspace',
        },
      ],
    };

    console.log(`Language server initialization params:\n${JSON.stringify(initParams, null, 4)}`);
    try {
      const result: InitializeResult = await this.connection.sendRequest('initialize', initParams);
      console.log('Language server initialized...');
      console.log(`Language server capabilities:\n${JSON.stringify(result.capabilities, null, 4)}`);
      this.isInitialized = true;
      await this.connection.sendNotification('initialized', {});
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait a moment for the server to be fully ready
      return result;
    } catch (error) {
      throw new Error(
        `Failed to initialize language server: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Triggers the compilation of the given ALFA file using the language server
   */
  async compile(inputFile: string): Promise<string[]> {
    // Always use language server for compilation - no fallback
    this.diagnostics.clear();
    await this.clearCompilationOutputDir();
    if (!this.isReady()) {
      throw new Error(
        'Language server is not initialized. Please call initialize() before compiling.'
      );
    }

    await this.didChangeWatchedFiles(inputFile);

    // TODO: Improve this with a more robust mechanism to ensure the server has processed the file change
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait a moment for the server to process the change

    if (this.diagnostics.size > 0) {
      const allDiagnostics = Array.from(this.diagnostics.values()).flat();
      const errorDiagnostics = allDiagnostics.filter((diag) => diag.severity === 1);
      if (errorDiagnostics.length > 0) {
        const errorMessages = errorDiagnostics.map(
          (diag) =>
            `Line ${diag.range.start.line + 1}, Col ${diag.range.start.character + 1}: ${diag.message}`
        );
        throw new Error(`Compilation failed with errors:\n${errorMessages.join('\n')}`);
      }
    }
    const compiledResult = await this.getCompilationOutput();

    console.debug('Compiled result:');
    console.debug(compiledResult);
    return compiledResult;
  }

  /**
   * Clear the compilation output directory. This is the
   * directory where the language server writes compiled files.
   */
  private async clearCompilationOutputDir(): Promise<void> {
    // Delete old output files to avoid confusion
    const outputDir = this.outputDir;
    try {
      const oldFiles = await fs.readdir(outputDir);
      for (const file of oldFiles) {
        const filePath = path.join(outputDir, file);
        await fs.unlink(filePath);
      }
    } catch (deleteError) {
      throw new Error(
        `Failed to clean old output files: ${deleteError instanceof Error ? deleteError.message : String(deleteError)}`
      );
    }
  }

  /**
   * Notify the language server of watched file changes
   */
  didChangeWatchedFiles(uri: string): Promise<void> {
    return this.connection.sendNotification('workspace/didChangeWatchedFiles', {
      changes: [
        {
          uri: URI.file(uri).toString(),
          type: FileChangeType.Changed,
        },
      ],
    });
  }

  /**
   * Request compilation from the ALFA language server
   */
  async getCompilationOutput(): Promise<string[]> {
    if (!this.connection) {
      throw new Error('Language server connection not available');
    }

    // Read all files in output directory
    const outputDir = this.outputDir;
    try {
      const files = await fs.readdir(outputDir);
      const outputs: string[] = [];
      for (const file of files) {
        const fullPath = path.join(outputDir, file);
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          outputs.push(content);
        } catch (readError) {
          console.error(
            `Failed to read output file ${fullPath}: ${readError instanceof Error ? readError.message : String(readError)}`
          );
        }
      }
      return outputs;
    } catch (error) {
      throw new Error(
        `Failed to read output directory: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Stop the language server
   */
  async stop(): Promise<void> {
    try {
      if (this.connection && this.isInitialized) {
        // Send shutdown request
        await this.connection.sendRequest('shutdown', null);

        // Send exit notification
        await this.connection.sendNotification('exit');

        // Dispose connection
        this.connection.dispose();
      }

      if (this.serverProcess) {
        this.serverProcess.kill();
      }

      this.serverProcess = null;
      this.isInitialized = false;
      this.diagnostics.clear();

      console.log('Language server stopped');
    } catch (error) {
      console.error('Error stopping language server:', error);
    }
  }

  /**
   * Check if the language server is running and initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.connection !== null;
  }

  /**
   * Set up event handlers for the language server
   */
  private setupEventHandlers(): void {
    if (!this.connection) return;

    // Handle diagnostics
    this.connection.onNotification(
      'textDocument/publishDiagnostics',
      (params: PublishDiagnosticsParams) => {
        this.diagnostics.set(params.uri, params.diagnostics);
        console.log(`Received ${params.diagnostics.length} diagnostics for ${params.uri}`);
      }
    );

    // Handle server errors
    this.connection.onError((error) => {
      console.error('Language server error:', error);
    });

    // Handle server close
    this.connection.onClose(() => {
      console.log('Language server connection closed');
      this.isInitialized = false;
    });
  }

  /**
   * Get client capabilities
   */
  private getClientCapabilities(): ClientCapabilities {
    return {
      textDocument: {
        synchronization: {
          dynamicRegistration: false,
          willSave: true,
          willSaveWaitUntil: true,
          didSave: true,
        },
        diagnostic: {
          dynamicRegistration: true,
          relatedDocumentSupport: true,
        },
      },
      workspace: {
        workspaceFolders: true,
        configuration: true,
      },
    };
  }
}
