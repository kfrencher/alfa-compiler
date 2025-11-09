import { ChildProcess, spawn } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import {
  createMessageConnection,
  Logger,
  MessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
} from "vscode-jsonrpc/node.js";
import {
  ClientCapabilities,
  Diagnostic,
  InitializeParams,
  InitializeResult,
  PublishDiagnosticsParams,
} from "vscode-languageserver-protocol";
import { URI } from "vscode-uri";
import { FileChangeType } from "vscode-languageserver-protocol";
import { fileURLToPath } from "url";
import { formatXml } from "./xml-utils.js";
import { delay } from "./utils.js";
import { createLogger } from "./logger.js";

export interface LanguageServerConfig {
  command: string;
  cwd: string;
  args: string[];
}

export interface CompiledFile {
  fileName: string;
  content: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class AlfaLanguageServerClient {
  private afterDidChangeWatchedFilesDelay = 1000; // ms
  private afterInitializeDelay = 2000; // ms
  private connection: MessageConnection;
  private serverProcess: ChildProcess | null = null;
  private isInitialized = false;
  private diagnostics: Map<string, Diagnostic[]> = new Map();
  private outputDir = path.join(path.resolve(__dirname, ".."), "src-gen");
  private logger = createLogger("AlfaLanguageServerClient");

  constructor(private config: LanguageServerConfig) {
    // Start the language server process
    this.logger.info(`Starting language server with command: ${this.config.command} ${this.config.args.join(" ")}`);
    this.serverProcess = spawn(this.config.command, this.config.args);

    if (!this.serverProcess.stdout || !this.serverProcess.stdin) {
      throw new Error("Failed to create language server process streams");
    }

    // Create message connection
    const reader = new StreamMessageReader(this.serverProcess.stdout);
    const writer = new StreamMessageWriter(this.serverProcess.stdin);

    this.connection = createMessageConnection(reader, writer, {
      error: (message: string) => this.logger.error("LSP Error:", message),
      warn: (message: string) => this.logger.warn("LSP Warning:", message),
      info: (message: string) => this.logger.info("LSP Info:", message),
      log: (message: string) => this.logger.info("LSP Log:", message),
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
      throw new Error("Language server is already initialized");
    }

    this.logger.info("Initializing language server...");

    const initParams: InitializeParams = {
      processId: process.pid,
      capabilities: this.getClientCapabilities(),
      rootUri: null, // This is unused. Use workspaceFolders instead.
      workspaceFolders: [
        {
          uri: URI.file(`${this.config.cwd}`).toString(),
          name: "workspace",
        },
      ],
    };

    this.logger.info(`Language server initialization params:\n${JSON.stringify(initParams, null, 4)}`);
    try {
      const result: InitializeResult = await this.connection.sendRequest("initialize", initParams);
      this.logger.info("Language server initialized...");
      this.logger.info(`Language server capabilities:\n${JSON.stringify(result.capabilities, null, 4)}`);
      this.isInitialized = true;
      await this.connection.sendNotification("initialized", {});
      await delay(this.afterInitializeDelay); // Wait a moment for the server to be fully ready
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
  async compileFiles(inputFiles: string[]): Promise<CompiledFile[]> {
    // Always use language server for compilation - no fallback
    this.diagnostics.clear();
    await this.clearCompilationOutputDir();
    if (!this.isReady()) {
      throw new Error("Language server is not initialized. Please call initialize() before compiling.");
    }

    await this.didChangeWatchedFiles(inputFiles, FileChangeType.Changed);

    // TODO: Improve this with a more robust mechanism to ensure the server has processed the file change
    await delay(this.afterDidChangeWatchedFilesDelay); // Wait a moment for the server to process the change

    if (this.diagnostics.size > 0) {
      const allDiagnostics = Array.from(this.diagnostics.values()).flat();
      const errorDiagnostics = allDiagnostics.filter((diag) => diag.severity === 1);
      if (errorDiagnostics.length > 0) {
        const errorMessages = errorDiagnostics.map(
          (diag) => `Line ${diag.range.start.line + 1}, Col ${diag.range.start.character + 1}: ${diag.message}`
        );
        const errorOutput = `Compilation failed with errors:\n${errorMessages.join("\n")}`;
        this.logger.error(errorOutput);
        throw new Error(errorOutput);
      }
    }
    const compiledResult = await this.getCompilationOutput();
    await this.clearCompilationOutputDir(); // Clean up after reading

    this.logger.debug("Compiled result:\n" + JSON.stringify(compiledResult, null, 4));
    return compiledResult;
  }

  /**
   * Triggers the compilation of the given ALFA file using the language server
   */
  async compile(inputFile: string): Promise<CompiledFile[]> {
    // Always use language server for compilation - no fallback
    this.diagnostics.clear();
    await this.clearCompilationOutputDir();
    if (!this.isReady()) {
      throw new Error("Language server is not initialized. Please call initialize() before compiling.");
    }

    await this.didChangeWatchedFiles(inputFile, FileChangeType.Changed);

    // TODO: Improve this with a more robust mechanism to ensure the server has processed the file change
    await delay(this.afterDidChangeWatchedFilesDelay); // Wait a moment for the server to process the change

    if (this.diagnostics.size > 0) {
      const allDiagnostics = Array.from(this.diagnostics.values()).flat();
      const errorDiagnostics = allDiagnostics.filter((diag) => diag.severity === 1);
      if (errorDiagnostics.length > 0) {
        const errorMessages = errorDiagnostics.map(
          (diag) => `Line ${diag.range.start.line + 1}, Col ${diag.range.start.character + 1}: ${diag.message}`
        );
        const errorOutput = `Compilation failed with errors:\n${errorMessages.join("\n")}`;
        this.logger.error(errorOutput);
        throw new Error(errorOutput);
      }
    }
    const compiledResult = await this.getCompilationOutput();
    await this.clearCompilationOutputDir(); // Clean up after reading

    this.logger.debug("Compiled result:\n" + JSON.stringify(compiledResult, null, 4));
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
  didChangeWatchedFiles(uri: string | string[], type: FileChangeType): Promise<void> {
    const changes =
      uri instanceof Array
        ? uri.map((fileUri) => ({
            uri: URI.file(fileUri).toString(),
            type: type,
          }))
        : [
            {
              uri: URI.file(uri).toString(),
              type: type,
            },
          ];

    return this.connection.sendNotification("workspace/didChangeWatchedFiles", {
      changes: changes,
    });
  }

  /**
   * Request compilation from the ALFA language server
   */
  async getCompilationOutput(): Promise<CompiledFile[]> {
    if (!this.connection) {
      throw new Error("Language server connection not available");
    }

    // Read all files in output directory
    const outputDir = this.outputDir;
    try {
      const files = await fs.readdir(outputDir);
      const outputs: CompiledFile[] = [];
      for (const file of files) {
        const fullPath = path.join(outputDir, file);
        try {
          const content = await fs.readFile(fullPath, "utf-8");
          outputs.push({
            fileName: file,
            content: formatXml(content),
          });
        } catch (readError) {
          this.logger.error(
            `Failed to read output file ${fullPath}: ${readError instanceof Error ? readError.message : String(readError)}`
          );
        }
      }
      return outputs;
    } catch (error) {
      throw new Error(`Failed to read output directory: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Stop the language server
   */
  async stop(): Promise<void> {
    try {
      if (this.connection && this.isInitialized) {
        // Send shutdown request
        await this.connection.sendRequest("shutdown", null);

        // Send exit notification
        await this.connection.sendNotification("exit");

        // Dispose connection
        this.connection.dispose();
      }

      if (this.serverProcess) {
        this.serverProcess.kill();
      }

      this.serverProcess = null;
      this.isInitialized = false;
      this.diagnostics.clear();

      this.logger.info("Language server stopped");
    } catch (error) {
      this.logger.error("Error stopping language server:", error);
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
    this.connection.onNotification("textDocument/publishDiagnostics", (params: PublishDiagnosticsParams) => {
      this.diagnostics.set(params.uri, params.diagnostics);
      this.logger.debug(`Received ${params.diagnostics.length} diagnostics for ${params.uri}`);
    });

    // Handle server errors
    this.connection.onError((error) => {
      this.logger.error("Language server error:", error);
    });

    // Handle server close
    this.connection.onClose(() => {
      this.logger.info("Language server connection closed");
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
