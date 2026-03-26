import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  validateHost,
  validatePortRange,
  getRequiredEnv,
  getRequiredNumberEnv,
  getDeviceProtocol,
  sanitizeLogMessage,
  UnknownError,
} from "../utils.js";

describe("validateHost", () => {
  it("accepts a valid hostname", () => {
    expect(() => validateHost("ddns.example.com")).not.toThrow();
  });

  it("accepts a valid IP address", () => {
    expect(() => validateHost("192.168.1.1")).not.toThrow();
  });

  it("accepts host:port format", () => {
    expect(() => validateHost("10.30.1.2:8084")).not.toThrow();
  });

  it("rejects empty string", () => {
    expect(() => validateHost("")).toThrow("Invalid host address");
  });

  it("rejects string with spaces", () => {
    expect(() => validateHost("host name")).toThrow("Invalid host address");
  });

  it("rejects string starting with dot", () => {
    expect(() => validateHost(".example.com")).toThrow("Invalid host address");
  });
});

describe("validatePortRange", () => {
  it("accepts valid port range", () => {
    expect(() => validatePortRange(8084, 8099)).not.toThrow();
  });

  it("accepts equal start and end port", () => {
    expect(() => validatePortRange(8084, 8084)).not.toThrow();
  });

  it("rejects start port below 1", () => {
    expect(() => validatePortRange(0, 8099)).toThrow("START_PORT");
  });

  it("rejects end port above 65535", () => {
    expect(() => validatePortRange(1, 65536)).toThrow("END_PORT");
  });

  it("rejects start > end", () => {
    expect(() => validatePortRange(9000, 8000)).toThrow("must be <=");
  });

  it("rejects non-integer ports", () => {
    expect(() => validatePortRange(80.5, 8099)).toThrow("START_PORT");
  });

  it("rejects port range exceeding maximum size", () => {
    expect(() => validatePortRange(1, 1001)).toThrow("Port range too large");
  });

  it("accepts port range at maximum size", () => {
    expect(() => validatePortRange(1, 1000)).not.toThrow();
  });
});

describe("getRequiredEnv", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("returns the value when env var exists", () => {
    process.env.TEST_VAR = "hello";
    expect(getRequiredEnv("TEST_VAR")).toBe("hello");
  });

  it("throws when env var is missing", () => {
    delete process.env.TEST_VAR;
    expect(() => getRequiredEnv("TEST_VAR")).toThrow(
      "Missing required environment variable: TEST_VAR",
    );
  });

  it("throws when env var is empty string", () => {
    process.env.TEST_VAR = "";
    expect(() => getRequiredEnv("TEST_VAR")).toThrow(
      "Missing required environment variable: TEST_VAR",
    );
  });
});

describe("getRequiredNumberEnv", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("returns a number when env var is a valid number", () => {
    process.env.TEST_NUM = "42";
    expect(getRequiredNumberEnv("TEST_NUM")).toBe(42);
  });

  it("throws when env var is not a number", () => {
    process.env.TEST_NUM = "abc";
    expect(() => getRequiredNumberEnv("TEST_NUM")).toThrow(
      "must be a finite number",
    );
  });

  it("throws when env var is missing", () => {
    delete process.env.TEST_NUM;
    expect(() => getRequiredNumberEnv("TEST_NUM")).toThrow(
      "Missing required environment variable",
    );
  });
});

describe("sanitizeLogMessage", () => {
  it("redacts password fields in text", () => {
    const msg = 'password="secret123" other data';
    expect(sanitizeLogMessage(msg)).not.toContain("secret123");
  });

  it("redacts XML password elements", () => {
    const msg = "<password>mysecret</password>";
    expect(sanitizeLogMessage(msg)).not.toContain("mysecret");
  });

  it("redacts digestAuth values", () => {
    const msg = 'digestAuth="admin:pass123"';
    expect(sanitizeLogMessage(msg)).not.toContain("pass123");
  });

  it("leaves non-sensitive messages unchanged", () => {
    const msg = "Connection failed for 10.0.0.1:8084";
    expect(sanitizeLogMessage(msg)).toBe(msg);
  });
});

describe("getDeviceProtocol", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("returns http by default", () => {
    delete process.env.DEVICE_PROTOCOL;
    expect(getDeviceProtocol()).toBe("http");
  });

  it("returns https when configured", () => {
    process.env.DEVICE_PROTOCOL = "https";
    expect(getDeviceProtocol()).toBe("https");
  });

  it("throws on invalid protocol", () => {
    process.env.DEVICE_PROTOCOL = "ftp";
    expect(() => getDeviceProtocol()).toThrow('DEVICE_PROTOCOL must be "http" or "https"');
  });
});

describe("UnknownError", () => {
  it("wraps an Error with its message", () => {
    const original = new Error("something broke");
    const err = new UnknownError(original);
    expect(err.message).toBe("something broke");
    expect(err.success).toBe(false);
    expect(err.name).toBe("UnknownError");
  });

  it("wraps a non-Error with default message", () => {
    const err = new UnknownError("string error");
    expect(err.message).toBe("Unknown error");
    expect(err.success).toBe(false);
  });

  it("toJSON returns message and success", () => {
    const err = new UnknownError(new Error("test"));
    expect(err.toJSON()).toEqual({
      message: "test",
      success: false,
    });
  });
});
