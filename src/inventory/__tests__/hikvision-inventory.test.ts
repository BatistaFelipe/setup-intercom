import { describe, it, expect, vi, beforeEach } from "vitest";

const FIXTURES = {
  deviceInfo: `<?xml version="1.0" encoding="UTF-8"?>
<DeviceInfo version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
  <deviceName>OUTDOOR STATION</deviceName>
  <deviceID>7d49925b-4fc7-406b-a0ec-000000000000</deviceID>
  <model>DS-KV9503-WBE1</model>
  <serialNumber>DS-KV9503-WBE10020230627ENAD0807991</serialNumber>
  <macAddress>e0:ca:3c:eb:54:f1</macAddress>
  <firmwareVersion>V2.3.13</firmwareVersion>
  <firmwareReleasedDate>build 240814</firmwareReleasedDate>
  <hardwareVersion>0x10101</hardwareVersion>
  <deviceType>VIS</deviceType>
</DeviceInfo>`,
  sipConfig: `<?xml version="1.0" encoding="UTF-8"?>
<SIPServerList version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
  <SIPServer>
    <id>1</id>
    <Standard>
      <enabled>true</enabled>
      <registerStatus>true</registerStatus>
      <proxy>sip.example.com</proxy>
      <proxyPort>7060</proxyPort>
      <userName>1458</userName>
      <displayName>1458</displayName>
      <authID>1458</authID>
      <expires>15</expires>
    </Standard>
  </SIPServer>
</SIPServerList>`,
  networkInterfaces: `<?xml version="1.0" encoding="UTF-8"?>
<NetworkInterfaceList version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
  <NetworkInterface version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
    <id>1</id>
    <IPAddress version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
      <ipVersion>v4</ipVersion>
      <addressingType>static</addressingType>
      <ipAddress>192.168.2.105</ipAddress>
      <subnetMask>255.255.255.0</subnetMask>
      <DefaultGateway>
        <ipAddress>192.168.2.1</ipAddress>
      </DefaultGateway>
    </IPAddress>
    <Link version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
      <MACAddress>e0:ca:3c:eb:54:f1</MACAddress>
      <autoNegotiation>true</autoNegotiation>
      <speed>100</speed>
      <duplex>full</duplex>
      <MTU min="1500" max="1500">1500</MTU>
    </Link>
    <defaultConnection>true</defaultConnection>
  </NetworkInterface>
</NetworkInterfaceList>`,
  time: `<?xml version="1.0" encoding="UTF-8"?>
<Time version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
  <timeMode>manual</timeMode>
  <localTime>2026-03-26T12:50:48+08:00</localTime>
  <timeZone>CST-8:00:00</timeZone>
</Time>`,
};

const mockRequest = vi.fn();

vi.mock("urllib", () => ({
  request: (...args: unknown[]) => mockRequest(...args),
}));

vi.mock("dotenv/config", () => ({}));

let hikvisionInventory: typeof import("../hikvision-inventory.js");

beforeEach(async () => {
  vi.clearAllMocks();
  hikvisionInventory = await import("../hikvision-inventory.js");
});

function mockSuccessResponse(body: string) {
  return { data: Buffer.from(body), res: { status: 200 } };
}

function mockErrorResponse() {
  return { data: null, res: { status: 401 } };
}

describe("hikvisionInventory.probe", () => {
  it("returns true when device responds with DeviceInfo XML", async () => {
    mockRequest.mockResolvedValueOnce(
      mockSuccessResponse(FIXTURES.deviceInfo),
    );

    const result = await hikvisionInventory.probe(
      "10.0.0.1:8084",
      { user: "admin", password: "pass" },
    );
    expect(result).toBe(true);
    expect(mockRequest.mock.calls[0][0]).toContain("/ISAPI/System/deviceInfo");
  });

  it("returns false when device returns non-200", async () => {
    mockRequest.mockResolvedValueOnce(mockErrorResponse());

    const result = await hikvisionInventory.probe(
      "10.0.0.1:8084",
      { user: "admin", password: "pass" },
    );
    expect(result).toBe(false);
  });

  it("returns false when device returns HTML page (Khomp)", async () => {
    const khompHtml = "<html><body><h1>KHOMP IP Intercom</h1></body></html>";
    mockRequest.mockResolvedValueOnce(mockSuccessResponse(khompHtml));

    const result = await hikvisionInventory.probe(
      "10.0.0.1:8089",
      { user: "admin", password: "pass" },
    );
    expect(result).toBe(false);
  });

  it("returns false when request throws", async () => {
    mockRequest.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const result = await hikvisionInventory.probe(
      "10.0.0.1:8084",
      { user: "admin", password: "pass" },
    );
    expect(result).toBe(false);
  });
});

describe("hikvisionInventory.collect", () => {
  it("returns full DeviceInventory when all endpoints respond", async () => {
    mockRequest
      .mockResolvedValueOnce(mockSuccessResponse(FIXTURES.deviceInfo))
      .mockResolvedValueOnce(mockSuccessResponse(FIXTURES.sipConfig))
      .mockResolvedValueOnce(mockSuccessResponse(FIXTURES.networkInterfaces))
      .mockResolvedValueOnce(mockSuccessResponse(FIXTURES.time));

    const result = await hikvisionInventory.collect(
      "10.0.0.1:8084",
      { user: "admin", password: "pass" },
    );

    expect(result.address).toBe("10.0.0.1:8084");
    expect(result.vendor).toBe("HIKVISION");
    expect(result.model).toBe("DS-KV9503-WBE1");
    expect(result.firmware).toBe("V2.3.13 build 240814");
    expect(result.serialNumber).toBe(
      "DS-KV9503-WBE10020230627ENAD0807991",
    );
    expect(result.macAddress).toBe("e0:ca:3c:eb:54:f1");
    expect(result.sipExtension).toBe("1458");
    expect(result.sipTimeout).toBe(15);
    expect(result.autoReboot).toBeNull();
    expect(result.lanIp).toBe("192.168.2.105");
    expect(result.deviceDatetime).toBe("2026-03-26T12:50:48+08:00");
  });

  it("returns partial data when some endpoints fail", async () => {
    mockRequest
      .mockResolvedValueOnce(mockSuccessResponse(FIXTURES.deviceInfo))
      .mockRejectedValueOnce(new Error("timeout"))
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(mockSuccessResponse(FIXTURES.time));

    const result = await hikvisionInventory.collect(
      "10.0.0.1:8084",
      { user: "admin", password: "pass" },
    );

    expect(result.vendor).toBe("HIKVISION");
    expect(result.model).toBe("DS-KV9503-WBE1");
    expect(result.macAddress).toBe("e0:ca:3c:eb:54:f1");
    expect(result.sipExtension).toBeNull();
    expect(result.sipTimeout).toBeNull();
    expect(result.lanIp).toBeNull();
    expect(result.deviceDatetime).toBe("2026-03-26T12:50:48+08:00");
  });

  it("uses MAC from interfaces when deviceInfo MAC is absent", async () => {
    const deviceInfoNoMac = FIXTURES.deviceInfo.replace(
      "<macAddress>e0:ca:3c:eb:54:f1</macAddress>",
      "<macAddress></macAddress>",
    );
    mockRequest
      .mockResolvedValueOnce(mockSuccessResponse(deviceInfoNoMac))
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(
        mockSuccessResponse(FIXTURES.networkInterfaces),
      )
      .mockRejectedValueOnce(new Error("timeout"));

    const result = await hikvisionInventory.collect(
      "10.0.0.1:8084",
      { user: "admin", password: "pass" },
    );

    expect(result.macAddress).toBe("e0:ca:3c:eb:54:f1");
  });

  it("makes 4 concurrent HTTP requests", async () => {
    for (let i = 0; i < 4; i++) {
      mockRequest.mockResolvedValueOnce(
        mockSuccessResponse(FIXTURES.deviceInfo),
      );
    }

    await hikvisionInventory.collect("10.0.0.1:8084", { user: "admin", password: "pass" });
    expect(mockRequest).toHaveBeenCalledTimes(4);
  });
});
