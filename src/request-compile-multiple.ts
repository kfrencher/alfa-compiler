import { rm, writeFile } from "fs/promises";
import { IncomingMessage, ServerResponse } from "http";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { compileFiles, notifyDeletedFiles } from "@/compiler";
import { CompiledFile } from "@/language-server-client";
import { delay } from "@/utils";
import { createLogger } from "@/logger";

const logger = createLogger("request-compile-multiple.ts");

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = resolve(__dirname, "..");
const policiesDir = join(packageRoot, "server", "policies");

export interface CompileMultipleRequest {
  files: CompiledFile[];
}

/**
 * Handles an upload of a alfa file and returns the compiled XACML output
 */
export async function handleCompileMultipleRequest(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method Not Allowed. Use POST." }));
    return;
  }

  const contentType = req.headers["content-type"] || "";

  if (!contentType.startsWith("application/json")) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Content-Type must be application/json" }));
    return;
  }

  // Read the request body. The body should be a JSON object
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });
  await new Promise<void>((resolve) => req.on("end", () => resolve()));

  // Check Content-Length header first
  if (!body) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Empty content" }));
    return;
  }

  let parsed: CompileMultipleRequest;
  try {
    parsed = JSON.parse(body) as CompileMultipleRequest;
  } catch (error) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON body" + (error instanceof Error ? `: ${error.message}` : "") }));
    return;
  }

  if (!parsed.files || !Array.isArray(parsed.files) || parsed.files.length === 0) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "No files provided" }));
    return;
  }

  // Write the content of each file to a temporary file
  const tempFilePaths: string[] = [];
  try {
    for (const file of parsed.files) {
      if (!file.fileName || !file.content) {
        throw new Error("Each file must have a filename and content");
      }
      const tempFilePath = join(policiesDir, `uploaded-${Date.now()}-${file.fileName}`);
      await writeFile(tempFilePath, file.content, "utf-8");
      tempFilePaths.push(tempFilePath);
    }
    // Compile the first temporary file
    const result = await compileFiles(tempFilePaths);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, output: result }));
  } catch (error) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    return;
  } finally {
    if (tempFilePaths.length > 0) {
      for (const tempFilePath of tempFilePaths) {
        try {
          await rm(tempFilePath, { force: true });
          logger.info(`Cleaned up temporary file: ${tempFilePath}`);
        } catch (cleanupError) {
          logger.warn("Failed to clean up temporary files:", cleanupError);
        }
      }
      await delay(500);
      await notifyDeletedFiles(tempFilePaths);
    }
  }
}
