import { request } from "urllib";
import type { DeviceInventory, AutoRebootStatus, DeviceProtocol, VendorCredentials, VendorInventoryAdapter } from "./types.js";

const HTTP_TIMEOUT = 5000;

export function parseCgiTable(text: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const rawKey = trimmed.slice(0, eqIndex);
    const value = trimmed.slice(eqIndex + 1);
    const key = rawKey.replace(/^table\./, "");
    result[key] = value;
  }

  return result;
}

async function fetchCgi(
  address: string,
  cgiPath: string,
  credentials: VendorCredentials,
  protocol: DeviceProtocol = "http",
): Promise<string | null> {
  try {
    const url = `${protocol}://${address}${cgiPath}`;
    const { data, res } = await request(url, {
      method: "GET",
      timeout: HTTP_TIMEOUT,
      digestAuth: `${credentials.user}:${credentials.password}`,
    });

    if (res.status === 200 && data) {
      return data.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function parseModel(text: string | null): string | null {
  if (!text) return null;
  const table = parseCgiTable(text);
  return table["type"] ?? null;
}

function parseFirmware(text: string | null): string | null {
  if (!text) return null;
  const table = parseCgiTable(text);
  return table["version"] ?? null;
}

function parseSerialNumber(text: string | null): string | null {
  if (!text) return null;
  const table = parseCgiTable(text);
  return table["sn"] ?? null;
}

function parseSipConfig(
  text: string | null,
): { extension: string | null; timeout: number | null } {
  if (!text) return { extension: null, timeout: null };
  const table = parseCgiTable(text);
  const extension = table["SIP.AuthID"] ?? null;
  const rawTimeout = table["SIP.RegExpiration"];
  const timeout = rawTimeout ? Number(rawTimeout) : null;
  return { extension, timeout };
}

function parseAutoReboot(text: string | null): AutoRebootStatus | null {
  if (!text) return null;
  const table = parseCgiTable(text);
  const enableRaw = table["AutoMaintain.AutoRebootEnable"];
  if (enableRaw === undefined) return null;

  return {
    enabled: enableRaw.toLowerCase() === "true",
    day: Number(table["AutoMaintain.AutoRebootDay"] ?? 0),
    hour: Number(table["AutoMaintain.AutoRebootHour"] ?? 0),
  };
}

function parseNetwork(
  text: string | null,
): { lanIp: string | null; macAddress: string | null } {
  if (!text) return { lanIp: null, macAddress: null };
  const table = parseCgiTable(text);
  const lanIp = table["Network.eth0.IPAddress"] ?? null;
  const macAddress = table["Network.eth0.PhysicalAddress"] ?? null;
  return { lanIp, macAddress };
}

function parseDatetime(text: string | null): string | null {
  if (!text) return null;
  const table = parseCgiTable(text);
  return table["result"] ?? null;
}

export async function probe(
  address: string,
  credentials: VendorCredentials,
  protocol: DeviceProtocol = "http",
): Promise<boolean> {
  const text = await fetchCgi(
    address,
    "/cgi-bin/magicBox.cgi?action=getDeviceType",
    credentials,
    protocol,
  );
  if (text === null) return false;
  // Reject HTML responses (Khomp devices return HTML login pages on any path)
  if (/<html/i.test(text)) return false;
  return /^type=.+/m.test(text);
}

export async function collect(
  address: string,
  credentials: VendorCredentials,
  protocol: DeviceProtocol = "http",
): Promise<DeviceInventory> {
  const [
    deviceTypeRaw,
    firmwareRaw,
    serialRaw,
    sipRaw,
    autoMaintainRaw,
    networkRaw,
    datetimeRaw,
  ] = await Promise.allSettled([
    fetchCgi(address, "/cgi-bin/magicBox.cgi?action=getDeviceType", credentials, protocol),
    fetchCgi(address, "/cgi-bin/magicBox.cgi?action=getSoftwareVersion", credentials, protocol),
    fetchCgi(address, "/cgi-bin/magicBox.cgi?action=getSerialNo", credentials, protocol),
    fetchCgi(address, "/cgi-bin/configManager.cgi?action=getConfig&name=SIP", credentials, protocol),
    fetchCgi(address, "/cgi-bin/configManager.cgi?action=getConfig&name=AutoMaintain", credentials, protocol),
    fetchCgi(address, "/cgi-bin/configManager.cgi?action=getConfig&name=Network", credentials, protocol),
    fetchCgi(address, "/cgi-bin/global.cgi?action=getCurrentTime", credentials, protocol),
  ]);

  const settled = <T>(r: PromiseSettledResult<T>): T | null =>
    r.status === "fulfilled" ? r.value : null;

  const sip = parseSipConfig(settled(sipRaw));
  const network = parseNetwork(settled(networkRaw));

  return {
    address,
    vendor: "INTELBRAS",
    model: parseModel(settled(deviceTypeRaw)),
    firmware: parseFirmware(settled(firmwareRaw)),
    serialNumber: parseSerialNumber(settled(serialRaw)),
    macAddress: network.macAddress,
    lanIp: network.lanIp,
    sipExtension: sip.extension,
    sipTimeout: sip.timeout,
    autoReboot: parseAutoReboot(settled(autoMaintainRaw)),
    deviceDatetime: parseDatetime(settled(datetimeRaw)),
  };
}

const intelbrasInventory: VendorInventoryAdapter = { probe, collect };
export default intelbrasInventory;
