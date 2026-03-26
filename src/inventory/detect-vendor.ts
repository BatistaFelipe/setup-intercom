import { probe as intelbrasProbe } from "./intelbras-inventory.js";
import { probe as hikvisionProbe } from "./hikvision-inventory.js";
import type { DeviceProtocol, DeviceVendor, InventoryCredentials } from "./types.js";

export async function detectVendor(
  address: string,
  credentials: InventoryCredentials,
  protocol: DeviceProtocol = "http",
): Promise<DeviceVendor> {
  const isIntelbras = await intelbrasProbe(address, credentials.intelbras, protocol);
  if (isIntelbras) return "INTELBRAS";

  const isHikvision = await hikvisionProbe(address, credentials.hikvision, protocol);
  if (isHikvision) return "HIKVISION";

  return "KHOMP";
}
