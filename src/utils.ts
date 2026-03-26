import fs from "fs/promises";
import { readFile } from "fs/promises";
import path from "node:path";
import winston, { Logger } from "winston";
import pLimit from "p-limit";
import { DefaultResponse } from "./types.js";

const myFormat = winston.format.printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level}]: ${message}`;
});

const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_LOG_FILES = 3;

const loggerInstance: Logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    myFormat,
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: "./data/combined.log",
      maxsize: MAX_LOG_SIZE,
      maxFiles: MAX_LOG_FILES,
    }),
  ],
});

export { loggerInstance as log };

export function promisesLimit() {
  return pLimit(10);
}

export class UnknownError extends Error {
  public readonly success: boolean = false;
  constructor(error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    super(message);
    this.name = "UnknownError";
  }

  toJSON() {
    return {
      message: this.message,
      success: this.success,
    };
  }
}

export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getRequiredNumberEnv(name: string): number {
  const raw = getRequiredEnv(name);
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`Environment variable ${name} must be a finite number, got: ${raw}`);
  }
  return value;
}

const HOST_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9.\-:]*$/;

export function validateHost(address: string): void {
  if (!address || !HOST_REGEX.test(address)) {
    throw new Error(`Invalid host address: ${address}`);
  }
}

const MAX_PORT_RANGE = 1000;

export function validatePortRange(startPort: number, endPort: number): void {
  if (!Number.isInteger(startPort) || startPort < 1 || startPort > 65535) {
    throw new Error(`START_PORT must be an integer between 1 and 65535, got: ${startPort}`);
  }
  if (!Number.isInteger(endPort) || endPort < 1 || endPort > 65535) {
    throw new Error(`END_PORT must be an integer between 1 and 65535, got: ${endPort}`);
  }
  if (startPort > endPort) {
    throw new Error(`START_PORT (${startPort}) must be <= END_PORT (${endPort})`);
  }
  const range = endPort - startPort + 1;
  if (range > MAX_PORT_RANGE) {
    throw new Error(`Port range too large (${range} ports). Maximum allowed: ${MAX_PORT_RANGE}`);
  }
}

const SENSITIVE_PATTERNS = [
  /password["\s:>=]+[^\s<"&]+/gi,
  /<password>[^<]*<\/password>/gi,
  /digestAuth["\s:>=]+[^\s<"&]+/gi,
];

export function sanitizeLogMessage(message: string): string {
  let sanitized = message;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }
  return sanitized;
}

export function getDeviceProtocol(): "http" | "https" {
  const protocol = process.env.DEVICE_PROTOCOL?.toLowerCase();
  if (protocol && protocol !== "http" && protocol !== "https") {
    throw new Error(`DEVICE_PROTOCOL must be "http" or "https", got: ${protocol}`);
  }
  return (protocol as "http" | "https") || "http";
}

export const saveToFile = async (filename: string, data: string) => {
  try {
    await fs.writeFile(filename, data, "utf-8");
    return { message: "File saved successfully", success: true };
  } catch (error: unknown) {
    const customError = new UnknownError(error);
    return customError.toJSON();
  }
};

export async function readHostsFile(
  filename: string,
): Promise<DefaultResponse> {
  try {
    const resolved = path.resolve(filename);
    const projectRoot = path.resolve(".");
    if (!resolved.startsWith(projectRoot + path.sep)) {
      return {
        message: "File path must be within the project directory",
        success: false,
      };
    }

    const fileData: string = await readFile(resolved, "utf-8");

    return {
      message: fileData,
      success: true,
    };
  } catch (error: unknown) {
    const customError = new UnknownError(error);

    return customError.toJSON();
  }
}
