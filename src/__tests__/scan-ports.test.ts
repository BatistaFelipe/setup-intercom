import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "events";

function createMockSocket(behavior: "open" | "error" | "timeout" = "open") {
  const emitter = new EventEmitter();
  (emitter as any).setTimeout = vi.fn();
  (emitter as any).destroy = vi.fn();

  (emitter as any).connect = vi.fn(
    function (this: EventEmitter, _port: number, _host: string, cb: () => void) {
      if (behavior === "open") {
        process.nextTick(() => cb());
      } else if (behavior === "error") {
        process.nextTick(() => emitter.emit("error", new Error("ECONNREFUSED")));
      } else {
        process.nextTick(() => emitter.emit("timeout"));
      }
      return emitter;
    },
  );

  return emitter;
}

let socketBehaviorQueue: Array<"open" | "error" | "timeout"> = [];

vi.mock("net", () => {
  return {
    default: {
      Socket: vi.fn(function () {
        const behavior = socketBehaviorQueue.shift() ?? "open";
        return createMockSocket(behavior);
      }),
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  socketBehaviorQueue = [];
});

describe("scanPort", () => {
  it("returns success when port is open", async () => {
    socketBehaviorQueue = ["open"];
    const { scanPort } = await import("../services/scan-ports.js");
    const result = await scanPort("localhost", 8084);
    expect(result.success).toBe(true);
    expect(result.message).toBe("localhost:8084");
  });

  it("returns failure when connection errors", async () => {
    socketBehaviorQueue = ["error"];
    const { scanPort } = await import("../services/scan-ports.js");
    const result = await scanPort("localhost", 9999);
    expect(result.success).toBe(false);
    expect(result.message).toContain("Error");
  });

  it("returns failure when connection times out", async () => {
    socketBehaviorQueue = ["timeout"];
    const { scanPort } = await import("../services/scan-ports.js");
    const result = await scanPort("localhost", 9999);
    expect(result.success).toBe(false);
    expect(result.message).toContain("Timeout");
  });
});

describe("scanPortList", () => {
  it("returns only open ports", async () => {
    socketBehaviorQueue = ["open", "open", "open"];
    const { scanPortList } = await import("../services/scan-ports.js");
    const result = await scanPortList("localhost", 8084, 8086);
    const parsed = JSON.parse(result.message);
    expect(result.success).toBe(true);
    expect(parsed.hosts).toHaveLength(3);
    expect(parsed.hosts).toContain("localhost:8084");
  });

  it("filters out closed ports", async () => {
    socketBehaviorQueue = ["open", "error", "open", "timeout"];
    const { scanPortList } = await import("../services/scan-ports.js");
    const result = await scanPortList("localhost", 8084, 8087);
    const parsed = JSON.parse(result.message);
    expect(result.success).toBe(true);
    expect(parsed.hosts).toHaveLength(2);
    expect(parsed.hosts).toContain("localhost:8084");
    expect(parsed.hosts).toContain("localhost:8086");
  });

  it("returns empty array when all ports are closed", async () => {
    socketBehaviorQueue = ["error", "timeout"];
    const { scanPortList } = await import("../services/scan-ports.js");
    const result = await scanPortList("localhost", 8084, 8085);
    const parsed = JSON.parse(result.message);
    expect(result.success).toBe(true);
    expect(parsed.hosts).toHaveLength(0);
  });
});
