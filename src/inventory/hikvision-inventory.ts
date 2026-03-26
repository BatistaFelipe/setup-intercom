import { request } from "urllib";
import { xml2json } from "xml-js";
import type { DeviceInventory, DeviceProtocol, VendorCredentials, VendorInventoryAdapter } from "./types.js";

const HTTP_TIMEOUT = 5000;

async function fetchIsapi(
  address: string,
  isapiPath: string,
  credentials: VendorCredentials,
  protocol: DeviceProtocol = "http",
): Promise<string | null> {
  try {
    const url = `${protocol}://${address}${isapiPath}`;
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

function parseXml(xml: string | null): Record<string, unknown> | null {
  if (!xml) return null;
  try {
    return JSON.parse(xml2json(xml, { compact: true, spaces: 4 }));
  } catch {
    return null;
  }
}

function getXmlText(obj: unknown, ...path: string[]): string | null {
  let current: unknown = obj;
  for (const key of path) {
    if (current == null || typeof current !== "object") return null;
    current = (current as Record<string, unknown>)[key];
  }
  if (current == null) return null;
  if (typeof current === "object") {
    if ("_text" in current) {
      const text = (current as { _text: unknown })._text;
      return text != null ? String(text) : null;
    }
    return null;
  }
  return String(current);
}

interface DeviceInfoFields {
  model: string | null;
  serialNumber: string | null;
  macAddress: string | null;
  firmware: string | null;
}

function parseDeviceInfo(xml: string | null): DeviceInfoFields {
  const empty: DeviceInfoFields = {
    model: null,
    serialNumber: null,
    macAddress: null,
    firmware: null,
  };
  const parsed = parseXml(xml);
  if (!parsed) return empty;

  const model = getXmlText(parsed, "DeviceInfo", "model");
  const serialNumber = getXmlText(parsed, "DeviceInfo", "serialNumber");
  const macRaw = getXmlText(parsed, "DeviceInfo", "macAddress");
  const macAddress = macRaw && macRaw.trim() !== "" ? macRaw : null;

  const firmwareVersion = getXmlText(parsed, "DeviceInfo", "firmwareVersion");
  const firmwareDate = getXmlText(parsed, "DeviceInfo", "firmwareReleasedDate");
  const firmware =
    firmwareVersion && firmwareDate
      ? `${firmwareVersion} ${firmwareDate}`
      : firmwareVersion;

  return { model, serialNumber, macAddress, firmware };
}

function parseSipConfig(
  xml: string | null,
): { extension: string | null; timeout: number | null } {
  const parsed = parseXml(xml);
  if (!parsed) return { extension: null, timeout: null };

  const extension = getXmlText(
    parsed,
    "SIPServerList",
    "SIPServer",
    "Standard",
    "authID",
  );
  const rawTimeout = getXmlText(
    parsed,
    "SIPServerList",
    "SIPServer",
    "Standard",
    "expires",
  );
  const timeout = rawTimeout ? Number(rawTimeout) : null;
  return { extension, timeout };
}

function parseNetworkInterfaces(
  xml: string | null,
): { lanIp: string | null; macAddress: string | null } {
  const parsed = parseXml(xml);
  if (!parsed) return { lanIp: null, macAddress: null };

  const lanIp = getXmlText(
    parsed,
    "NetworkInterfaceList",
    "NetworkInterface",
    "IPAddress",
    "ipAddress",
  );
  const macAddress = getXmlText(
    parsed,
    "NetworkInterfaceList",
    "NetworkInterface",
    "Link",
    "MACAddress",
  );
  return { lanIp, macAddress };
}

function parseTime(xml: string | null): string | null {
  const parsed = parseXml(xml);
  if (!parsed) return null;
  return getXmlText(parsed, "Time", "localTime");
}

export async function probe(
  address: string,
  credentials: VendorCredentials,
  protocol: DeviceProtocol = "http",
): Promise<boolean> {
  const xml = await fetchIsapi(address, "/ISAPI/System/deviceInfo", credentials, protocol);
  if (xml === null) return false;
  // Require valid ISAPI XML, reject HTML responses from non-Hikvision devices
  return xml.includes("<DeviceInfo");
}

export async function collect(
  address: string,
  credentials: VendorCredentials,
  protocol: DeviceProtocol = "http",
): Promise<DeviceInventory> {
  const [deviceInfoRaw, sipRaw, interfacesRaw, timeRaw] =
    await Promise.allSettled([
      fetchIsapi(address, "/ISAPI/System/deviceInfo", credentials, protocol),
      fetchIsapi(address, "/ISAPI/System/Network/SIP", credentials, protocol),
      fetchIsapi(address, "/ISAPI/System/Network/interfaces", credentials, protocol),
      fetchIsapi(address, "/ISAPI/System/time", credentials, protocol),
    ]);

  const settled = <T>(r: PromiseSettledResult<T>): T | null =>
    r.status === "fulfilled" ? r.value : null;

  const deviceInfo = parseDeviceInfo(settled(deviceInfoRaw));
  const sip = parseSipConfig(settled(sipRaw));
  const network = parseNetworkInterfaces(settled(interfacesRaw));

  return {
    address,
    vendor: "HIKVISION",
    model: deviceInfo.model,
    firmware: deviceInfo.firmware,
    serialNumber: deviceInfo.serialNumber,
    macAddress: deviceInfo.macAddress ?? network.macAddress,
    lanIp: network.lanIp,
    sipExtension: sip.extension,
    sipTimeout: sip.timeout,
    autoReboot: null,
    deviceDatetime: parseTime(settled(timeRaw)),
  };
}

const hikvisionInventory: VendorInventoryAdapter = { probe, collect };
export default hikvisionInventory;
