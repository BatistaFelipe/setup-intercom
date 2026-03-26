import { scanPortList } from "../services/scan-ports.js";
import { validateHost, validatePortRange, promisesLimit } from "../utils.js";
import { detectVendor } from "./detect-vendor.js";
import { collect as intelbrasCollect } from "./intelbras-inventory.js";
import { collect as hikvisionCollect } from "./hikvision-inventory.js";
import type {
  QueryCondominiumOptions,
  QueryDeviceOptions,
  CondominiumInventory,
  DeviceInventory,
  InventoryError,
  InventoryCredentials,
  DeviceVendor,
} from "./types.js";

const pLimit = promisesLimit();

async function collectByVendor(
  address: string,
  vendor: DeviceVendor,
  credentials: InventoryCredentials,
): Promise<DeviceInventory> {
  if (vendor === "INTELBRAS") {
    const auth = `${credentials.intelbras.user}:${credentials.intelbras.password}`;
    return intelbrasCollect(address, auth);
  }

  if (vendor === "HIKVISION") {
    const auth = `${credentials.hikvision.user}:${credentials.hikvision.password}`;
    return hikvisionCollect(address, auth);
  }

  return {
    address,
    vendor: "KHOMP",
    model: null,
    firmware: null,
    serialNumber: null,
    macAddress: null,
    lanIp: null,
    sipExtension: null,
    sipTimeout: null,
    autoReboot: null,
    deviceDatetime: null,
  };
}

export async function queryCondominium(
  options: QueryCondominiumOptions,
): Promise<CondominiumInventory> {
  validateHost(options.host);
  validatePortRange(options.startPort, options.endPort);

  const scanResult = await scanPortList(
    options.host,
    options.startPort,
    options.endPort,
  );
  const { hosts: openPorts } = JSON.parse(scanResult.message) as {
    hosts: string[];
  };

  const devices: DeviceInventory[] = [];
  const errors: InventoryError[] = [];

  const tasks = openPorts.map((address) =>
    pLimit(async () => {
      try {
        const vendor = await detectVendor(address, options.credentials);
        const device = await collectByVendor(
          address,
          vendor,
          options.credentials,
        );
        devices.push(device);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        errors.push({ address, message: msg });
      }
    }),
  );

  await Promise.all(tasks);

  return {
    host: options.host,
    queriedAt: new Date().toISOString(),
    devices,
    errors,
  };
}

export async function queryDevice(
  options: QueryDeviceOptions,
): Promise<DeviceInventory> {
  const { address, credentials } = options;

  if (!address || !address.includes(":")) {
    throw new Error(`Invalid device address: ${address}`);
  }

  const vendor = await detectVendor(address, credentials);
  return collectByVendor(address, vendor, credentials);
}
