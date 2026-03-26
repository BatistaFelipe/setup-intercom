import { probe as intelbrasProbe } from "./intelbras-inventory.js";
import { probe as hikvisionProbe } from "./hikvision-inventory.js";
import type { DeviceVendor, InventoryCredentials } from "./types.js";

export async function detectVendor(
  address: string,
  credentials: InventoryCredentials,
): Promise<DeviceVendor> {
  const intelbrasAuth = `${credentials.intelbras.user}:${credentials.intelbras.password}`;
  const isIntelbras = await intelbrasProbe(address, intelbrasAuth);
  if (isIntelbras) return "INTELBRAS";

  const hikvisionAuth = `${credentials.hikvision.user}:${credentials.hikvision.password}`;
  const isHikvision = await hikvisionProbe(address, hikvisionAuth);
  if (isHikvision) return "HIKVISION";

  return "KHOMP";
}
