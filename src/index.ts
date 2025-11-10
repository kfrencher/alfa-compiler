#!/usr/bin/env node
import { createServer } from "http";
import { parse } from "url";
import { IncomingMessage, ServerResponse } from "http";
import { handleCompileRequest } from "@/request-compile";
import { handleCompileMultipleRequest } from "@/request-compile-multiple";
import { createLogger } from "@/logger";
import { CompiledFile } from "@/language-server-client";

export type CompileResponse =
  | {
      success: boolean;
      output: CompiledFile[];
    }
  | {
      error: string;
    };

const logger = createLogger("index.ts");

// Simple web server
const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  const { pathname } = parse(req.url || "", true);

  const handleError = (err: unknown) => {
    const error = err instanceof Error ? err : "Unknown error";
    logger.error(`Error handling compile request: ${error}`);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end(`Internal Server Error: ${error}`);
  };

  switch (pathname) {
    case "/compile":
      handleCompileRequest(req, res).catch(handleError);
      break;

    case "/compile-multiple":
      handleCompileMultipleRequest(req, res).catch(handleError);
      break;

    default:
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
  }
});

server.listen(3000, () => {
  logger.info("Server running on http://localhost:3000");
});

// Handle graceful shutdown
process.on("SIGINT", () => {
  logger.info("\nReceived SIGINT, shutting down gracefully...");
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  logger.info("\nReceived SIGTERM, shutting down gracefully...");
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
});
