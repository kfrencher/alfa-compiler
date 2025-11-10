import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { spawn, ChildProcess } from "child_process";
import { readFile } from "fs/promises";
import * as path from "path";
import { multiFileAlfaPolicy } from "@test/resources/policies/multi-file-policy";
import { CompiledFile } from "@/language-server-client";
import { fail } from "assert";
import { delay } from "@/utils";
import { logger } from "@/logger";
import { CompileResponse } from "@/index";

const debug = process.env.DEBUG === "true" || false;

describe("HTTP Server", () => {
  let serverProcess: ChildProcess;
  const baseUrl = "http://localhost:3000";
  const policyDir = path.join(__dirname, "resources", "policies");

  beforeAll(async () => {
    // Then start the server directly
    logger.info("Starting server...");
    serverProcess = spawn("node", ["dist/index.js"], {
      stdio: "pipe",
    });

    // Wait for server to start
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Server startup timeout"));
      }, 15000);

      serverProcess.stdout?.on("data", (data: string) => {
        const output = data.toString();
        if (output.includes("Server running on")) {
          logger.info("Server started successfully");
          clearTimeout(timeout);
          resolve(undefined);
        }
      });

      serverProcess.stderr?.on("data", (data: string) => {
        clearTimeout(timeout);
        reject(new Error(`Server error: ${data.toString()}`));
      });

      if (debug) {
        serverProcess.stdout?.on("data", (data: string) => {
          logger.info("Server output:", data.toString());
        });
        serverProcess.stderr?.on("data", (data: string) => {
          logger.info("Server error output:", data.toString());
        });
      }
    });
  }, 10000);

  afterAll(async () => {
    // Stop the server
    if (serverProcess) {
      logger.info("Stopping server...");
      serverProcess.kill("SIGTERM");

      // Wait for "server closed" message or process exit
      await new Promise((resolve) => {
        serverProcess.on("exit", () => {
          logger.info("Server process exited");
          // Give some time for cleanup
          delay(3000)
            .then(() => resolve(undefined))
            .catch(() => resolve(undefined));
        });

        delay(5000)
          .then(() => {
            logger.error("Server did not shut down gracefully, killed forcefully");
            serverProcess.kill("SIGKILL");
            resolve(undefined);
          })
          .catch(() => {
            resolve(undefined);
          });
      });
    }
  }, 10000);

  test("should return 404 for unknown endpoints", async () => {
    const response = await fetch(`${baseUrl}/unknown`);
    expect(response.status).toBe(404);

    const text = await response.text();
    expect(text).toBe("Not found");
  });

  test("should reject non-POST requests on /compile", async () => {
    const response = await fetch(`${baseUrl}/compile`, {
      method: "GET",
    });

    expect(response.status).toBe(405);

    const json = (await response.json()) as CompileResponse;
    if ("error" in json) {
      expect(json.error).toBe("Method Not Allowed. Use POST.");
    } else {
      fail("Expected error response");
    }
  });

  test("should reject requests without text/plain content type", async () => {
    const response = await fetch(`${baseUrl}/compile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ test: "data" }),
    });

    expect(response.status).toBe(400);

    const json = (await response.json()) as CompileResponse;
    if ("error" in json) {
      expect(json.error).toBe("Content-Type must be text/plain");
    } else {
      fail("Expected error response");
    }
  });

  test("should reject empty file content", async () => {
    const response = await fetch(`${baseUrl}/compile`, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
      },
      body: "",
    });

    expect(response.status).toBe(400);

    const json = (await response.json()) as CompileResponse;
    if ("error" in json) {
      expect(json.error).toBe("Empty file content");
    } else {
      fail("Expected error response");
    }
  });

  test("should compile valid ALFA content", async () => {
    const alfaContent = await readFile(path.join(policyDir, "valid-policy.alfa.txt"), "utf-8");

    const response = await fetch(`${baseUrl}/compile`, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
      },
      body: alfaContent,
    });

    expect(response.status).toBe(200);

    const json = (await response.json()) as CompileResponse;
    if ("error" in json) {
      fail(`Unexpected error response: ${json.error}`);
    }
    expect(json.success).toBe(true);
    expect(json.output).toBeDefined();

    const output = json.output;
    expect(Array.isArray(output)).toBe(true);
    expect(output.length).toBeGreaterThan(0);
    expect(output.length).toBe(1);

    const firstOutput = output[0];
    if (!firstOutput) {
      throw new Error("No compiled output found");
    }
    const content = firstOutput.content;
    expect(content).toContain("xacml3:Policy");
    expect(content).toContain("xacml3:Target");
    expect(content).toContain("xacml3:Rule");
    expect(content).toContain("http://axiomatics.com/alfa/identifier/testTxt.validPolicy");
  });

  test("should compile valid multifile ALFA content", async () => {
    const alfaContent = JSON.stringify(multiFileAlfaPolicy, null, 4);
    // const alfaContent = '';

    const response = await fetch(`${baseUrl}/compile-multiple`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: alfaContent,
    });

    expect(response.status).toBe(200);

    const json = (await response.json()) as { success: boolean; output: CompiledFile[] };
    expect(json.success).toBe(true);
    expect(json.output).toBeDefined();
    const output = json.output;
    expect(Array.isArray(output)).toBe(true);
    expect(output.length).toBeGreaterThan(0);
    expect(output.length).toBe(3);
    expect(output.length).toBe(3);
    const root = output.find((f) => f.fileName === "system_a.root.xml");
    if (!root) fail("Root policy not found in output");

    const content = root.content;
    expect(content).toContain("xacml3:Policy");
    expect(content).toContain("xacml3:Target");
    expect(content).toContain("system_a.person");
    expect(content).toContain("system_a.group");
  }, 10000);
});
