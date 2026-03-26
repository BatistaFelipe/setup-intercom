import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DeviceInventory } from "../types.js";

const mockScanPortList = vi.fn();
const mockDetectVendor = vi.fn();
const mockIntelbrasCollect = vi.fn();
const mockHikvisionCollect = vi.fn();

vi.mock("../../services/scan-ports.js", () => ({
  scanPortList: (...args: unknown[]) => mockScanPortList(...args),
}));

vi.mock("../detect-vendor.js", () => ({
  detectVendor: (...args: unknown[]) => mockDetectVendor(...args),
}));

vi.mock("../intelbras-inventory.js", () => ({
  default: {
    probe: vi.fn(),
    collect: (...args: unknown[]) => mockIntelbrasCollect(...args),
  },
  collect: (...args: unknown[]) => mockIntelbrasCollect(...args),
}));

vi.mock("../hikvision-inventory.js", () => ({
  default: {
    probe: vi.fn(),
    collect: (...args: unknown[]) => mockHikvisionCollect(...args),
  },
  collect: (...args: unknown[]) => mockHikvisionCollect(...args),
}));

vi.mock("dotenv/config", () => ({}));

let queryCondominium: typeof import("../query.js").queryCondominium;
let queryDevice: typeof import("../query.js").queryDevice;

const CREDENTIALS = {
  intelbras: { user: "admin", password: "pass" },
  hikvision: { user: "admin", password: "pass" },
};

function makeDevice(
  address: string,
  vendor: DeviceInventory["vendor"],
): DeviceInventory {
  return {
    address,
    vendor,
    model: vendor === "KHOMP" ? null : `Model-${vendor}`,
    firmware: vendor === "KHOMP" ? null : "1.0.0",
    serialNumber: vendor === "KHOMP" ? null : "SN123",
    macAddress: vendor === "KHOMP" ? null : "aa:bb:cc:dd:ee:ff",
    lanIp: vendor === "KHOMP" ? null : "192.168.1.10",
    sipExtension: vendor === "KHOMP" ? null : "1001",
    sipTimeout: vendor === "KHOMP" ? null : 60,
    autoReboot: null,
    deviceDatetime: vendor === "KHOMP" ? null : "2026-03-26T12:00:00",
  };
}

beforeEach(async () => {
  vi.clearAllMocks();
  const mod = await import("../query.js");
  queryCondominium = mod.queryCondominium;
  queryDevice = mod.queryDevice;
});

describe("queryCondominium", () => {
  it("scans ports and returns devices for each open port", async () => {
    mockScanPortList.mockResolvedValueOnce({
      message: JSON.stringify({
        hosts: ["example.com:8084", "example.com:8085"],
      }),
      success: true,
    });
    mockDetectVendor
      .mockResolvedValueOnce("INTELBRAS")
      .mockResolvedValueOnce("HIKVISION");
    mockIntelbrasCollect.mockResolvedValueOnce(
      makeDevice("example.com:8084", "INTELBRAS"),
    );
    mockHikvisionCollect.mockResolvedValueOnce(
      makeDevice("example.com:8085", "HIKVISION"),
    );

    const result = await queryCondominium({
      host: "example.com",
      startPort: 8084,
      endPort: 8085,
      credentials: CREDENTIALS,
    });

    expect(result.host).toBe("example.com");
    expect(result.devices).toHaveLength(2);
    expect(result.devices[0].vendor).toBe("INTELBRAS");
    expect(result.devices[1].vendor).toBe("HIKVISION");
    expect(result.errors).toHaveLength(0);
    expect(result.queriedAt).toBeTruthy();
  });

  it("classifies KHOMP devices with minimal data", async () => {
    mockScanPortList.mockResolvedValueOnce({
      message: JSON.stringify({ hosts: ["example.com:8091"] }),
      success: true,
    });
    mockDetectVendor.mockResolvedValueOnce("KHOMP");

    const result = await queryCondominium({
      host: "example.com",
      startPort: 8084,
      endPort: 8099,
      credentials: CREDENTIALS,
    });

    expect(result.devices).toHaveLength(1);
    expect(result.devices[0].vendor).toBe("KHOMP");
    expect(result.devices[0].model).toBeNull();
    expect(result.devices[0].address).toBe("example.com:8091");
  });

  it("returns empty devices when no ports are open", async () => {
    mockScanPortList.mockResolvedValueOnce({
      message: JSON.stringify({ hosts: [] }),
      success: true,
    });

    const result = await queryCondominium({
      host: "example.com",
      startPort: 8084,
      endPort: 8099,
      credentials: CREDENTIALS,
    });

    expect(result.devices).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("captures errors per device without failing the whole query", async () => {
    mockScanPortList.mockResolvedValueOnce({
      message: JSON.stringify({
        hosts: ["example.com:8084", "example.com:8085"],
      }),
      success: true,
    });
    mockDetectVendor
      .mockResolvedValueOnce("INTELBRAS")
      .mockResolvedValueOnce("HIKVISION");
    mockIntelbrasCollect.mockResolvedValueOnce(
      makeDevice("example.com:8084", "INTELBRAS"),
    );
    mockHikvisionCollect.mockRejectedValueOnce(new Error("Connection lost"));

    const result = await queryCondominium({
      host: "example.com",
      startPort: 8084,
      endPort: 8085,
      credentials: CREDENTIALS,
    });

    expect(result.devices).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].address).toBe("example.com:8085");
    expect(result.errors[0].message).toBe("Connection lost");
  });

  it("validates host", async () => {
    await expect(
      queryCondominium({
        host: "",
        startPort: 8084,
        endPort: 8099,
        credentials: CREDENTIALS,
      }),
    ).rejects.toThrow("Invalid host");
  });

  it("validates port range", async () => {
    await expect(
      queryCondominium({
        host: "example.com",
        startPort: 9000,
        endPort: 8000,
        credentials: CREDENTIALS,
      }),
    ).rejects.toThrow("must be <=");
  });
});

describe("queryDevice", () => {
  it("detects vendor and collects device data", async () => {
    mockDetectVendor.mockResolvedValueOnce("INTELBRAS");
    mockIntelbrasCollect.mockResolvedValueOnce(
      makeDevice("example.com:8084", "INTELBRAS"),
    );

    const result = await queryDevice({
      address: "example.com:8084",
      credentials: CREDENTIALS,
    });

    expect(result.address).toBe("example.com:8084");
    expect(result.vendor).toBe("INTELBRAS");
    expect(result.model).toBe("Model-INTELBRAS");
  });

  it("returns minimal data for KHOMP devices", async () => {
    mockDetectVendor.mockResolvedValueOnce("KHOMP");

    const result = await queryDevice({
      address: "example.com:8091",
      credentials: CREDENTIALS,
    });

    expect(result.vendor).toBe("KHOMP");
    expect(result.model).toBeNull();
    expect(result.firmware).toBeNull();
  });

  it("validates address format", async () => {
    await expect(
      queryDevice({
        address: "",
        credentials: CREDENTIALS,
      }),
    ).rejects.toThrow();
  });
});
