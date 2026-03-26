import { describe, it, expect, vi, beforeEach } from "vitest";

const FIXTURES = {
  deviceType: "type=SS 3532 MF",
  softwareVersion: "version=1.000.00IB000.0.R,build:2024-03-19",
  serialNo: "sn=8LMM4809817TH",
  sipConfig: [
    "table.SIP.AlarmInCallCenter=false",
    "table.SIP.AnalogNumberEnd=",
    "table.SIP.AnalogNumberStart=",
    "table.SIP.AuthID=1104",
    "table.SIP.AuthPassword=password",
    "table.SIP.IsMainVTO=0",
    "table.SIP.LocalRTPPort=15000",
    "table.SIP.LocalSIPPort=5060",
    "table.SIP.OutboundProxy=voip_server_address",
    "table.SIP.OutboundProxyID=8000",
    "table.SIP.OutboundProxyPort=7060",
    "table.SIP.RegExpiration=60",
    "table.SIP.RegisterRealm=VDP",
    "table.SIP.Route[0]=sip:10.30.1.2:5060;lr",
    "table.SIP.RouteEnable=true",
    "table.SIP.SIPServer=voip_server_address",
    "table.SIP.SIPServerID=8000",
    "table.SIP.SIPServerPort=7060",
    "table.SIP.SIPServerRedundancy=0.0.0.0",
    "table.SIP.SIPServerRedundancyPassWord=admin",
    "table.SIP.SIPServerRedundancyUserName=admin",
    "table.SIP.STUNServer=192.168.1.111",
    "table.SIP.UserEnable=true",
    "table.SIP.UserID=1104",
    "table.SIP.UserType=0",
  ].join("\n"),
  autoMaintain: [
    "table.AutoMaintain.AutoRebootDay=7",
    "table.AutoMaintain.AutoRebootEnable=true",
    "table.AutoMaintain.AutoRebootHour=4",
    "table.AutoMaintain.AutoRebootMinute=0",
    "table.AutoMaintain.AutoShutdownDay=-1",
    "table.AutoMaintain.AutoShutdownHour=0",
    "table.AutoMaintain.AutoShutdownMinute=0",
    "table.AutoMaintain.AutoStartUpDay=-1",
    "table.AutoMaintain.AutoStartUpHour=0",
    "table.AutoMaintain.AutoStartUpMinute=0",
  ].join("\n"),
  network: [
    "table.Network.DefaultInterface=eth0",
    "table.Network.Domain=Intelbras",
    "table.Network.Hostname=BSC",
    "table.Network.eth0.DefaultGateway=192.168.2.1",
    "table.Network.eth0.DhcpEnable=false",
    "table.Network.eth0.DnsServers[0]=8.8.8.8",
    "table.Network.eth0.DnsServers[1]=8.8.4.4",
    "table.Network.eth0.EnableDhcpReservedIP=false",
    "table.Network.eth0.IPAddress=192.168.2.4",
    "table.Network.eth0.MTU=1500",
    "table.Network.eth0.PhysicalAddress=54:6c:ac:3a:02:2d",
    "table.Network.eth0.SubnetMask=255.255.255.0",
  ].join("\n"),
  currentTime: "result=2026-03-26 12:22:31",
};

const mockRequest = vi.fn();

vi.mock("urllib", () => ({
  request: (...args: unknown[]) => mockRequest(...args),
}));

vi.mock("dotenv/config", () => ({}));

let intelbrasInventory: typeof import("../intelbras-inventory.js");

beforeEach(async () => {
  vi.clearAllMocks();
  intelbrasInventory = await import("../intelbras-inventory.js");
});

function mockSuccessResponse(body: string) {
  return {
    data: Buffer.from(body),
    res: { status: 200 },
  };
}

function mockErrorResponse() {
  return {
    data: null,
    res: { status: 401 },
  };
}

describe("intelbrasInventory.probe", () => {
  it("returns true when device responds with type=", async () => {
    mockRequest.mockResolvedValueOnce(
      mockSuccessResponse(FIXTURES.deviceType),
    );

    const result = await intelbrasInventory.probe(
      "10.0.0.1:8084",
      { user: "admin", password: "pass" },
    );
    expect(result).toBe(true);
    expect(mockRequest).toHaveBeenCalledOnce();
    expect(mockRequest.mock.calls[0][0]).toContain("getDeviceType");
  });

  it("returns false when device returns non-200", async () => {
    mockRequest.mockResolvedValueOnce(mockErrorResponse());

    const result = await intelbrasInventory.probe(
      "10.0.0.1:8084",
      { user: "admin", password: "pass" },
    );
    expect(result).toBe(false);
  });

  it("returns false when device returns HTML page (Khomp)", async () => {
    const khompHtml = [
      "<html>",
      "<body>",
      '<h1>KHOMP IP Intercom</h1>',
      "<p>soft v 3.8.49 - hard v 16-M4-L</p>",
      '<form><input type="password"><input type="submit" value="Enviar"></form>',
      "</body>",
      "</html>",
    ].join("\n");
    mockRequest.mockResolvedValueOnce(mockSuccessResponse(khompHtml));

    const result = await intelbrasInventory.probe(
      "10.0.0.1:8089",
      { user: "admin", password: "pass" },
    );
    expect(result).toBe(false);
  });

  it("returns false when request throws", async () => {
    mockRequest.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const result = await intelbrasInventory.probe(
      "10.0.0.1:8084",
      { user: "admin", password: "pass" },
    );
    expect(result).toBe(false);
  });
});

describe("intelbrasInventory.collect", () => {
  it("returns full DeviceInventory when all endpoints respond", async () => {
    mockRequest
      .mockResolvedValueOnce(mockSuccessResponse(FIXTURES.deviceType))
      .mockResolvedValueOnce(mockSuccessResponse(FIXTURES.softwareVersion))
      .mockResolvedValueOnce(mockSuccessResponse(FIXTURES.serialNo))
      .mockResolvedValueOnce(mockSuccessResponse(FIXTURES.sipConfig))
      .mockResolvedValueOnce(mockSuccessResponse(FIXTURES.autoMaintain))
      .mockResolvedValueOnce(mockSuccessResponse(FIXTURES.network))
      .mockResolvedValueOnce(mockSuccessResponse(FIXTURES.currentTime));

    const result = await intelbrasInventory.collect(
      "10.0.0.1:8084",
      { user: "admin", password: "pass" },
    );

    expect(result.address).toBe("10.0.0.1:8084");
    expect(result.vendor).toBe("INTELBRAS");
    expect(result.model).toBe("SS 3532 MF");
    expect(result.firmware).toBe("1.000.00IB000.0.R,build:2024-03-19");
    expect(result.serialNumber).toBe("8LMM4809817TH");
    expect(result.sipExtension).toBe("1104");
    expect(result.sipTimeout).toBe(60);
    expect(result.autoReboot).toEqual({
      enabled: true,
      day: 7,
      hour: 4,
    });
    expect(result.lanIp).toBe("192.168.2.4");
    expect(result.macAddress).toBe("54:6c:ac:3a:02:2d");
    expect(result.deviceDatetime).toBe("2026-03-26 12:22:31");
  });

  it("returns partial data when some endpoints fail", async () => {
    mockRequest
      .mockResolvedValueOnce(mockSuccessResponse(FIXTURES.deviceType))
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(mockSuccessResponse(FIXTURES.serialNo))
      .mockRejectedValueOnce(new Error("timeout"))
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(mockSuccessResponse(FIXTURES.network))
      .mockRejectedValueOnce(new Error("timeout"));

    const result = await intelbrasInventory.collect(
      "10.0.0.1:8084",
      { user: "admin", password: "pass" },
    );

    expect(result.vendor).toBe("INTELBRAS");
    expect(result.model).toBe("SS 3532 MF");
    expect(result.firmware).toBeNull();
    expect(result.serialNumber).toBe("8LMM4809817TH");
    expect(result.sipExtension).toBeNull();
    expect(result.sipTimeout).toBeNull();
    expect(result.autoReboot).toBeNull();
    expect(result.lanIp).toBe("192.168.2.4");
    expect(result.macAddress).toBe("54:6c:ac:3a:02:2d");
    expect(result.deviceDatetime).toBeNull();
  });

  it("makes 7 concurrent HTTP requests", async () => {
    for (let i = 0; i < 7; i++) {
      mockRequest.mockResolvedValueOnce(
        mockSuccessResponse(FIXTURES.deviceType),
      );
    }

    await intelbrasInventory.collect("10.0.0.1:8084", { user: "admin", password: "pass" });
    expect(mockRequest).toHaveBeenCalledTimes(7);
  });
});

describe("parseCgiTable", () => {
  it("parses multi-line table response into key-value map", () => {
    const result = intelbrasInventory.parseCgiTable(FIXTURES.network);

    expect(result["Network.eth0.IPAddress"]).toBe("192.168.2.4");
    expect(result["Network.eth0.PhysicalAddress"]).toBe("54:6c:ac:3a:02:2d");
    expect(result["Network.DefaultInterface"]).toBe("eth0");
  });

  it("parses SIP config table", () => {
    const result = intelbrasInventory.parseCgiTable(FIXTURES.sipConfig);

    expect(result["SIP.AuthID"]).toBe("1104");
    expect(result["SIP.RegExpiration"]).toBe("60");
    expect(result["SIP.SIPServer"]).toBe("voip_server_address");
  });

  it("handles single-line response", () => {
    const result = intelbrasInventory.parseCgiTable("type=SS 3532 MF");
    expect(result["type"]).toBe("SS 3532 MF");
  });

  it("handles empty lines", () => {
    const result = intelbrasInventory.parseCgiTable(
      "key1=val1\n\nkey2=val2\n",
    );
    expect(result["key1"]).toBe("val1");
    expect(result["key2"]).toBe("val2");
  });
});
