import { describe, it, expect, vi, beforeEach } from "vitest";

const mockIntelbrasProbe = vi.fn();
const mockHikvisionProbe = vi.fn();

vi.mock("../intelbras-inventory.js", () => ({
  default: { probe: (...args: unknown[]) => mockIntelbrasProbe(...args), collect: vi.fn() },
  probe: (...args: unknown[]) => mockIntelbrasProbe(...args),
}));

vi.mock("../hikvision-inventory.js", () => ({
  default: { probe: (...args: unknown[]) => mockHikvisionProbe(...args), collect: vi.fn() },
  probe: (...args: unknown[]) => mockHikvisionProbe(...args),
}));

let detectVendor: typeof import("../detect-vendor.js").detectVendor;

beforeEach(async () => {
  vi.clearAllMocks();
  const mod = await import("../detect-vendor.js");
  detectVendor = mod.detectVendor;
});

const CREDENTIALS = {
  intelbras: { user: "admin", password: "pass" },
  hikvision: { user: "admin", password: "pass" },
};

describe("detectVendor", () => {
  it("returns INTELBRAS when Intelbras probe succeeds", async () => {
    mockIntelbrasProbe.mockResolvedValueOnce(true);

    const result = await detectVendor("10.0.0.1:8084", CREDENTIALS);
    expect(result).toBe("INTELBRAS");
    expect(mockIntelbrasProbe).toHaveBeenCalledOnce();
    expect(mockHikvisionProbe).not.toHaveBeenCalled();
  });

  it("returns HIKVISION when Intelbras fails and Hikvision succeeds", async () => {
    mockIntelbrasProbe.mockResolvedValueOnce(false);
    mockHikvisionProbe.mockResolvedValueOnce(true);

    const result = await detectVendor("10.0.0.1:8084", CREDENTIALS);
    expect(result).toBe("HIKVISION");
    expect(mockIntelbrasProbe).toHaveBeenCalledOnce();
    expect(mockHikvisionProbe).toHaveBeenCalledOnce();
  });

  it("returns KHOMP when both probes fail", async () => {
    mockIntelbrasProbe.mockResolvedValueOnce(false);
    mockHikvisionProbe.mockResolvedValueOnce(false);

    const result = await detectVendor("10.0.0.1:8084", CREDENTIALS);
    expect(result).toBe("KHOMP");
  });

  it("passes credential objects directly to each vendor probe", async () => {
    mockIntelbrasProbe.mockResolvedValueOnce(false);
    mockHikvisionProbe.mockResolvedValueOnce(true);

    await detectVendor("10.0.0.1:8084", CREDENTIALS);

    expect(mockIntelbrasProbe).toHaveBeenCalledWith(
      "10.0.0.1:8084",
      { user: "admin", password: "pass" },
      "http",
    );
    expect(mockHikvisionProbe).toHaveBeenCalledWith(
      "10.0.0.1:8084",
      { user: "admin", password: "pass" },
      "http",
    );
  });
});
